import os
import re
import json
import httpx
import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CodeSentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    pattern = r"github\.com/([^/]+)/([^/]+)/pull/(\d+)"
    match = re.search(pattern, url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid GitHub PR URL. Expected: https://github.com/owner/repo/pull/123")
    return match.group(1), match.group(2), int(match.group(3))


async def fetch_pr_data(owner: str, repo: str, pr_number: int, token: str = ""):
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "CodeSentinel/1.0"}
    if token:
        headers["Authorization"] = f"token {token}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        pr_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=headers,
        )
        if pr_resp.status_code == 404:
            raise HTTPException(status_code=404, detail="PR not found. Make sure the repo is public or provide a GitHub token.")
        if pr_resp.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token invalid or missing for private repo.")
        if pr_resp.status_code != 200:
            raise HTTPException(status_code=pr_resp.status_code, detail=f"GitHub API error: {pr_resp.text[:200]}")

        files_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files",
            headers=headers,
        )

    return pr_resp.json(), files_resp.json()


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

    return f"""You are a senior software engineer performing a thorough code review. Analyze this GitHub Pull Request carefully.

PR METADATA:
- Title: {pr_info.get("title", "N/A")}
- Description: {(pr_info.get("body") or "No description provided.")[:600]}
- Files Changed: {pr_info.get("changed_files", 0)} | +{pr_info.get("additions", 0)} / -{pr_info.get("deletions", 0)} lines
- Base Branch: {pr_info.get("base", {}).get("ref", "main")} ← {pr_info.get("head", {}).get("ref", "feature")}

CODE DIFF:
{diff_text}

Thoroughly review for:
1. Bugs and logical errors (null checks, off-by-one, race conditions, wrong logic)
2. Security vulnerabilities (injection, auth bypass, exposed secrets, insecure deserialization, SSRF)
3. Performance bottlenecks (N+1 queries, unnecessary loops, memory leaks, blocking calls)
4. Code smells (long functions, duplication, magic numbers, poor naming, deep nesting)
5. Best practice violations (error handling, logging, test coverage gaps, SOLID principles)

Respond ONLY with a valid raw JSON object matching this schema exactly (no markdown fences, no extra text):
{JSON_SCHEMA}"""


def build_code_prompt(code: str, language: str, filename: str) -> str:
    return f"""You are a senior software engineer performing a thorough code review.

FILE: {filename}
LANGUAGE: {language}

CODE:
```{language}
{code[:8000]}
```

Thoroughly review for:
1. Bugs and logical errors
2. Security vulnerabilities
3. Performance bottlenecks
4. Code smells and maintainability issues
5. Best practice violations

Respond ONLY with a valid raw JSON object matching this schema exactly (no markdown fences, no extra text):
{JSON_SCHEMA}"""


# ─── Claude Runner ───────────────────────────────────────────────────────────────

async def run_claude_review(prompt: str) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured on server.")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if model adds them
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")


# ─── Routes ──────────────────────────────────────────────────────────────────────

@app.post("/api/review/github")
async def review_github_pr(request: PRReviewRequest):
    owner, repo, pr_number = parse_pr_url(request.pr_url)
    pr_info, files = await fetch_pr_data(owner, repo, pr_number, request.github_token)
    prompt = build_pr_prompt(pr_info, files)
    result = await run_claude_review(prompt)

    result["pr_info"] = {
        "title": pr_info.get("title"),
        "url": pr_info.get("html_url"),
        "author": pr_info.get("user", {}).get("login"),
        "avatar": pr_info.get("user", {}).get("avatar_url"),
        "base": pr_info.get("base", {}).get("ref"),
        "head": pr_info.get("head", {}).get("ref"),
        "state": pr_info.get("state"),
        "changed_files": pr_info.get("changed_files"),
        "additions": pr_info.get("additions"),
        "deletions": pr_info.get("deletions"),
        "files": [{"name": f["filename"], "additions": f.get("additions", 0), "deletions": f.get("deletions", 0)} for f in files[:12]],
    }
    return result


@app.post("/api/review/code")
async def review_raw_code(request: CodeReviewRequest):
    if len(request.code.strip()) < 10:
        raise HTTPException(status_code=400, detail="Code is too short to review.")
    prompt = build_code_prompt(request.code, request.language, request.filename)
    return await run_claude_review(prompt)


@app.get("/health")
async def health():
    return {"status": "ok", "model": "claude-sonnet-4-20250514"}
