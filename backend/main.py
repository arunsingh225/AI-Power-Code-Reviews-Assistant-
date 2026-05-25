import os
import re
import json
import httpx
import logging
import asyncio
import time
from collections import defaultdict
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("CodeSentinel")

app = FastAPI(title="CodeSentinel API", version="1.1.0")

# ─── Production Configurations ──────────────────────────────────────────────────

# CORS restriction: lock allowed origins to Vite localhost port
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = allowed_origins_env.split(",")
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "https://frontend-az594qu4q-arunsingh225s-projects.vercel.app",
        "https://frontend-amber-beta-h3vpr041av.vercel.app",
    ]

logger.info(f"CORS configurations - Allowed Origins: {allowed_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-Memory Rate Limiting: Max 15 review requests per minute per client IP
RATE_LIMIT_LIMIT = 15
RATE_LIMIT_WINDOW = 60  # seconds
request_history = defaultdict(list)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/review"):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Filter and clean up timestamps older than the sliding window
        history = request_history[client_ip]
        history = [t for t in history if now - t < RATE_LIMIT_WINDOW]
        request_history[client_ip] = history
        
        if len(history) >= RATE_LIMIT_LIMIT:
            logger.warning(f"Rate limit hit! IP: {client_ip} has sent {len(history)} requests in {RATE_LIMIT_WINDOW}s")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. CodeSentinel allows up to 15 reviews per minute per IP."}
            )
        
        request_history[client_ip].append(now)
    
    return await call_next(request)

@app.on_event("startup")
async def startup_event():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        logger.critical("⚠️ CRITICAL WARNING: GEMINI_API_KEY environment variable is not configured! Review routes will fail.")
    else:
        logger.info("✅ Startup Check: GEMINI_API_KEY loaded successfully.")

# ─── Models ────────────────────────────────────────────────────────────────────

class PRReviewRequest(BaseModel):
    pr_url: str
    github_token: str = ""

class CodeReviewRequest(BaseModel):
    code: str
    language: str = "auto"
    filename: str = "snippet"

# ─── GitHub Helpers ─────────────────────────────────────────────────────────────

def parse_pr_url(url: str):
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
        
    pattern = r"github\.com/([^/]+)/([^/]+)/pull/(\d+)"
    match = re.search(pattern, url)
    if not match:
        logger.warning(f"Failed to parse PR URL format: {url}")
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub PR URL"
        )
    owner, repo, pr_number = match.group(1), match.group(2), int(match.group(3))
    logger.info(f"Extracted PR metadata: Owner={owner}, Repo={repo}, PR Number={pr_number}")
    return owner, repo, pr_number


async def fetch_pr_data(owner: str, repo: str, pr_number: int, token: str = ""):
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "CodeSentinel/1.0"}
    if token:
        headers["Authorization"] = f"token {token}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Performance optimization: Fetch PR metadata and PR files concurrently
            pr_task = client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
                headers=headers,
            )
            files_task = client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files",
                headers=headers,
            )
            
            pr_resp, files_resp = await asyncio.gather(pr_task, files_task)
    except httpx.TimeoutException:
        logger.error(f"GitHub API connection timed out for PR {owner}/{repo}#{pr_number}")
        raise HTTPException(
            status_code=504,
            detail="GitHub timeout"
        )
    except httpx.HTTPError as e:
        logger.error(f"GitHub API connection error: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail="Failed to connect to GitHub API"
        )

    if pr_resp.status_code == 404:
        logger.warning(f"PR not found (404) for: {owner}/{repo}#{pr_number}")
        raise HTTPException(status_code=404, detail="PR not found")
    if pr_resp.status_code == 401:
        logger.warning("PR fetch unauthorized (401).")
        raise HTTPException(status_code=401, detail="Invalid GitHub token")
    if pr_resp.status_code == 403:
        logger.warning("GitHub API rate limit exceeded (403).")
        raise HTTPException(status_code=403, detail="GitHub API limit exceeded")
    if pr_resp.status_code != 200:
        logger.error(f"GitHub PR fetch returned status {pr_resp.status_code}")
        raise HTTPException(status_code=pr_resp.status_code, detail=f"GitHub API returned error: {pr_resp.text[:200]}")
        
    if files_resp.status_code != 200:
        logger.error(f"GitHub files fetch returned status {files_resp.status_code}")
        raise HTTPException(status_code=files_resp.status_code, detail=f"Failed to fetch PR files: {files_resp.text[:200]}")

    files_json = files_resp.json()
    if not files_json:
        logger.warning(f"Empty files array received for PR: {owner}/{repo}#{pr_number}")
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub PR URL"
        )

    return pr_resp.json(), files_json


# ─── Prompt Builders ────────────────────────────────────────────────────────────

JSON_SCHEMA = """{
  "summary": "2-3 sentence overall assessment of the code quality",
  "overall_score": <integer 0-100>,
  "grade": "<A|B|C|D|F>",
  "issues": [
    {
      "id": "<string number>",
      "type": "<bug|security|performance|code_smell|best_practice>",
      "severity": "<critical|high|medium|low|info>",
      "file": "<filename or 'general'>",
      "line": <integer line number or null>,
      "title": "<short descriptive title>",
      "description": "<detailed explanation of the issue and why it matters>",
      "suggestion": "<specific actionable fix recommendation with example if possible>"
    }
  ],
  "positives": ["<strength 1>", "<strength 2>"],
  "metrics": {
    "bugs": <integer>,
    "security": <integer>,
    "performance": <integer>,
    "code_smells": <integer>,
    "best_practices": <integer>
  }
}"""


def build_pr_prompt(pr_info: dict, files: list) -> str:
    diff_sections = []
    for f in files[:12]:
        section = f"\n### {f['filename']} (+{f.get('additions',0)} -{f.get('deletions',0)})\n"
        if f.get("patch"):
            patch = f["patch"][:2500]
            section += f"```diff\n{patch}\n```\n"
        diff_sections.append(section)

    diff_text = "\n".join(diff_sections) or "No diff available."

    return f"""Analyze this GitHub Pull Request carefully and provide a structured JSON report.

PR METADATA:
- Title: {pr_info.get("title", "N/A")}
- Description: {(pr_info.get("body") or "No description provided.")[:600]}
- Files Changed: {pr_info.get("changed_files", 0)} | +{pr_info.get("additions", 0)} / -{pr_info.get("deletions", 0)} lines
- Base Branch: {pr_info.get("base", {}).get("ref", "main")} <- {pr_info.get("head", {}).get("ref", "feature")}

CODE DIFF:
{diff_text}

Verify issues and fill the following JSON schema:
{JSON_SCHEMA}"""


def build_code_prompt(code: str, language: str, filename: str) -> str:
    return f"""Analyze this file code snippet and provide a structured JSON report.

FILE: {filename}
LANGUAGE: {language}

CODE:
```{language}
{code[:8000]}
```

Verify issues and fill the following JSON schema:
{JSON_SCHEMA}"""


# ─── Gemini Runner ───────────────────────────────────────────────────────────────

def extract_json(raw: str) -> str:
    """Strip markdown fences and extract the JSON object."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()
    
    start = raw.find("{")
    end   = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end+1]
    return raw


async def run_gemini_review(prompt: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        logger.error("GEMINI_API_KEY not configured on server.")
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on server.")

    logger.info("Configuring Gemini API client...")
    genai.configure(api_key=api_key)

    model_name = "gemini-2.5-flash"
    
    # Prompt Injection Defense: Instructions reside securely in system_instruction
    system_instruction = """You are a senior software engineer performing a thorough, critical code review.
Your primary objective is to review code changes for:
1. Bugs and logical errors
2. Security vulnerabilities
3. Performance bottlenecks
4. Code smells
5. Best practice violations

You MUST respond with ONLY a valid raw JSON object matching the JSON schema provided in the user prompt. Do not include markdown formatting fences (do not wrap in ```json), explanation, or preambles. Your output must start with '{' and end with '}'."""

    logger.info(f"Initializing model: {model_name} with native system instructions")
    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config=genai.types.GenerationConfig(
            temperature=0.2,
            max_output_tokens=4096,
        ),
        system_instruction=system_instruction
    )

    logger.info("Sending request to Gemini API (non-blocking thread with retry fallback)...")
    max_retries = 3
    delay = 1.5
    response = None
    for attempt in range(1, max_retries + 1):
        try:
            response = await asyncio.to_thread(model.generate_content, prompt)
            raw = response.text
            logger.info(f"Gemini API call returned a response successfully on attempt {attempt}.")
            break
        except Exception as e:
            logger.warning(f"Gemini API attempt {attempt} failed with error: {e}")
            if attempt == max_retries:
                logger.error(f"Gemini API execution failed after {max_retries} attempts.", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Gemini API error after {max_retries} retries: {str(e)}")
            await asyncio.sleep(delay * attempt)

    raw_clean = extract_json(raw)

    try:
        parsed = json.loads(raw_clean)
        logger.info("Successfully parsed Gemini response as JSON.")
        return parsed
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON. Error: {str(e)}")
        logger.debug(f"Raw response: {raw}")
        logger.debug(f"Cleaned response: {raw_clean}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse AI response as JSON: {str(e)}. Cleaned: {raw_clean[:200]}"
        )


# ─── Routes ──────────────────────────────────────────────────────────────────────

class PostCommentRequest(BaseModel):
    pr_url: str
    github_token: str
    report: dict

@app.post("/api/review/github")
async def review_github_pr(request: PRReviewRequest):
    logger.info(f"Received GitHub PR review request for URL: {request.pr_url}")
    owner, repo, pr_number = parse_pr_url(request.pr_url)
    logger.info(f"Parsed PR details - Owner: {owner}, Repo: {repo}, PR #: {pr_number}")
    
    logger.info("Fetching PR information and diff files from GitHub...")
    pr_info, files = await fetch_pr_data(owner, repo, pr_number, request.github_token)
    logger.info(f"Successfully fetched PR data. Title: '{pr_info.get('title')}', Files count: {len(files)}")
    
    prompt = build_pr_prompt(pr_info, files)
    result = await run_gemini_review(prompt)

    # Convert files list to map for quick lookup
    files_map = {f["filename"]: f for f in files}

    result["pr_info"] = {
        "title":         pr_info.get("title"),
        "url":           pr_info.get("html_url"),
        "author":        pr_info.get("user", {}).get("login"),
        "avatar":        pr_info.get("user", {}).get("avatar_url"),
        "base":          pr_info.get("base", {}).get("ref"),
        "head":          pr_info.get("head", {}).get("ref"),
        "state":         pr_info.get("state"),
        "changed_files": pr_info.get("changed_files"),
        "additions":     pr_info.get("additions"),
        "deletions":     pr_info.get("deletions"),
        "files": [
            {
                "name":      f["filename"],
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "patch":     f.get("patch", ""), # Sent to frontend for diff rendering
            }
            for f in files[:12]
        ],
    }
    logger.info("Completed GitHub PR review successfully.")
    return result


@app.post("/api/review/github/post-comment")
async def post_github_comment(request: PostCommentRequest):
    logger.info(f"Posting GitHub PR comment for URL: {request.pr_url}")
    owner, repo, pr_number = parse_pr_url(request.pr_url)
    
    if not request.github_token.strip():
        raise HTTPException(status_code=400, detail="GitHub Token is required to post a comment.")
        
    report = request.report
    summary = report.get("summary", "No summary provided.")
    overall_score = report.get("overall_score", 0)
    grade = report.get("grade", "N/A")
    metrics = report.get("metrics", {})
    issues = report.get("issues", [])
    positives = report.get("positives", [])
    
    # Construct a highly professional markdown comment
    md = f"## 🔍 CodeSentinel Review Report\n\n"
    md += f"### 📊 Score: **{overall_score}/100** — Grade **{grade}**\n\n"
    md += f"#### 📝 Summary\n{summary}\n\n"
    
    md += f"#### 📈 Metrics\n"
    md += f"| Category | Count |\n"
    md += f"|---|---|\n"
    md += f"| 🐛 Bugs | {metrics.get('bugs', 0)} |\n"
    md += f"| 🔐 Security | {metrics.get('security', 0)} |\n"
    md += f"| ⚡ Performance | {metrics.get('performance', 0)} |\n"
    md += f"| 🔴 Code Smells | {metrics.get('code_smells', 0)} |\n"
    md += f"| 📋 Best Practices | {metrics.get('best_practices', 0)} |\n\n"
    
    if positives:
        md += "#### ✅ Key Strengths\n"
        for p in positives[:5]:
            md += f"- {p}\n"
        md += "\n"
        
    if issues:
        md += f"#### ⚠️ Code Issues ({len(issues)})\n"
        for idx, issue in enumerate(issues[:8], 1):
            severity_emoji = {
                "critical": "🔴",
                "high": "🟠",
                "medium": "🟡",
                "low": "🔵",
                "info": "⚪"
            }.get(issue.get("severity", "info"), "⚪")
            
            file_loc = issue.get("file", "general")
            line_loc = issue.get("line")
            loc_str = f"`{file_loc}`" + (f":{line_loc}" if line_loc else "")
            
            md += f"{severity_emoji} **{issue.get('title')}** (_{issue.get('type')}_) in {loc_str}\n"
            md += f"> {issue.get('description')}\n"
            if issue.get("suggestion"):
                md += f"> *Suggestion:* {issue.get('suggestion')}\n"
            md += "\n"
            
        if len(issues) > 8:
            md += f"*...and {len(issues) - 8} more issues. View details in CodeSentinel local console.*\n\n"
            
    md += "---\n*Review posted via CodeSentinel AI Code Review Agent powered by Gemini 2.5 Flash*"
    
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodeSentinel/1.0",
        "Authorization": f"token {request.github_token.strip()}"
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments",
            headers=headers,
            json={"body": md}
        )
        
    if resp.status_code == 201:
        logger.info("Successfully posted review comment to GitHub.")
        return {"status": "success", "comment_url": resp.json().get("html_url")}
    else:
        logger.error(f"Failed to post comment to GitHub: {resp.status_code} - {resp.text}")
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"GitHub API Error: {resp.json().get('message', resp.text)}"
        )


@app.post("/api/review/code")
async def review_raw_code(request: CodeReviewRequest):
    logger.info(f"Received raw code review request. Filename: '{request.filename}', Language: '{request.language}', Code length: {len(request.code)}")
    if len(request.code.strip()) < 10:
        logger.warning("Rejected raw code review request: Code snippet is too short.")
        raise HTTPException(status_code=400, detail="Code is too short to review.")
    prompt = build_code_prompt(request.code, request.language, request.filename)
    result = await run_gemini_review(prompt)
    logger.info("Completed raw code review successfully.")
    return result


@app.get("/health")
async def health():
    return {"status": "ok", "model": "gemini-2.5-flash"}

# ─── Unified Frontend Serving ──────────────────────────────────────────────────

backend_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dist_dir = os.path.abspath(os.path.join(backend_dir, "..", "frontend", "dist"))
assets_dir = os.path.join(frontend_dist_dir, "assets")
index_file = os.path.join(frontend_dist_dir, "index.html")

if os.path.exists(frontend_dist_dir):
    logger.info(f"Unified build detected! Serving static frontend from: {frontend_dist_dir}")
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        # Ignore API calls or health check
        if catchall.startswith("api/") or catchall == "health":
            raise HTTPException(status_code=404)
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build index.html not found.")
else:
    logger.warning(f"Unified build directory not found at: {frontend_dist_dir}. Running in API-only mode.")
