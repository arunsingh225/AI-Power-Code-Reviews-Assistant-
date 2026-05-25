import { useState, useEffect } from "react"
import axios from "axios"

const API = import.meta.env.VITE_API_URL || "/api"

const SEVERITY = {
  critical: { color: "#F5F5F5", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", label: "CRITICAL" },
  high:     { color: "#d0d0d0", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)", label: "HIGH"     },
  medium:   { color: "#a0a0a0", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)", label: "MEDIUM"   },
  low:      { color: "#00FFB2", bg: "rgba(0,255,178,0.05)",  border: "rgba(0,255,178,0.2)", label: "LOW"      },
  info:     { color: "#6b6b6b", bg: "rgba(255,255,255,0.01)", border: "rgba(255,255,255,0.05)", label: "INFO"     },
}

const TYPE_META = {
  bug:           { icon: "🐛", label: "Bug",           color: "#F5F5F5" },
  security:      { icon: "🔐", label: "Security",      color: "#d0d0d0" },
  performance:   { icon: "⚡", label: "Performance",   color: "#a0a0a0" },
  code_smell:    { icon: "🔴", label: "Code Smell",    color: "#808080" },
  best_practice: { icon: "📋", label: "Best Practice", color: "#6b6b6b" },
}

const LANGUAGES = ["auto","python","javascript","typescript","java","go","rust","c","cpp","csharp","php","ruby","swift","kotlin","sql","bash","yaml","json"]

function getScoreColor(score) {
  if (score >= 85) return "#00FFB2"
  if (score >= 70) return "#00E5FF"
  if (score >= 50) return "#a0a0a0"
  return "#6b6b6b"
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const radius = 54
  const circ = 2 * Math.PI * radius
  const dash = (score / 100) * circ
  const color = getScoreColor(score)
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg width="144" height="144" className="block">
          <circle cx="72" cy="72" r={radius} fill="none" stroke="#4a4a4a" strokeWidth="10" />
          <circle cx="72" cy="72" r={radius} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className="score-ring transition-all duration-1000"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-3xl" style={{ color }}>{score}</span>
          <span className="font-mono text-xs" style={{ color: "#6b6b6b" }}>/100</span>
        </div>
      </div>
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] || SEVERITY.info
  return (
    <span className="severity-badge"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

function TypeBadge({ type }) {
  const t = TYPE_META[type] || { icon: "📌", label: type, color: "#6b6b6b" }
  return (
    <span className="flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded"
      style={{ color: t.color, backgroundColor: `${t.color}18` }}>
      <span>{t.icon}</span><span>{t.label}</span>
    </span>
  )
}

// ── Issue Card ────────────────────────────────────────────────────────────────
function IssueCard({ issue, idx }) {
  const [expanded, setExpanded] = useState(false)
  const s = SEVERITY[issue.severity] || SEVERITY.info
  return (
    <div className="issue-card animate-fade-in-up"
      style={{ animationDelay: `${idx * 0.05}s`, borderLeft: `3px solid ${s.color}` }}
      onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={issue.severity} />
          <TypeBadge type={issue.type} />
          {issue.file && issue.file !== "general" && (
            <span className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ color: "#6b6b6b", background: "#2d2d2d" }}>
              {issue.file}{issue.line ? `:${issue.line}` : ""}
            </span>
          )}
        </div>
        <span style={{ color: "#6b6b6b" }} className="text-sm shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>
      <p className="font-sans font-medium mt-2 text-sm" style={{ color: "#f0f0f0" }}>{issue.title}</p>
      {expanded && (
        <div className="mt-3 space-y-3 pt-3" style={{ borderTop: "1px solid #4a4a4a" }}>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: "#6b6b6b" }}>Issue</p>
            <p className="text-sm leading-relaxed" style={{ color: "#a0a0a0" }}>{issue.description}</p>
          </div>
          {issue.suggestion && (
            <div>
              <p className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: "#00d9a3" }}>💡 Suggestion</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#a0a0a0" }}>{issue.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Metric Bar ────────────────────────────────────────────────────────────────
function MetricBar({ label, value, max, color }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs" style={{ color: "#a0a0a0" }}>{label}</span>
        <span className="font-mono text-xs font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#2d2d2d" }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Loading Screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  const [step, setStep] = useState(0)
  const steps = [
    "Fetching PR diff from GitHub...",
    "Parsing file changes...",
    "Running AI analysis...",
    "Detecting security vulnerabilities...",
    "Identifying performance bottlenecks...",
    "Generating review comments...",
    "Finalizing report...",
  ]
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % steps.length), 1200)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{ border: "2px solid rgba(255,255,255,0.1)" }}>
          <div className="w-16 h-16 rounded-full border-2 border-t-[#00FFB2] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl">🔍</span>
          </div>
        </div>
        <div className="absolute -inset-2 rounded-full animate-pulse-slow"
          style={{ background: "rgba(0,255,178,0.05)" }} />
      </div>
      <div className="text-center space-y-3">
        <h3 className="font-sans font-bold text-xl" style={{ color: "#f0f0f0" }}>Analyzing Code</h3>
        <p className="terminal-text cursor-blink">{steps[step]}</p>
      </div>
      <div className="flex gap-2">
        {steps.map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= step ? "#00FFB2" : "rgba(255,255,255,0.15)" }} />
        ))}
      </div>
    </div>
  )
}

// ── Results Dashboard ─────────────────────────────────────────────────────────
function ResultsDashboard({ data, onReset }) {
  const [filter, setFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  const issues = data.issues || []
  const metrics = data.metrics || {}
  const positives = data.positives || []
  const prInfo = data.pr_info
  const totalIssues = Object.values(metrics).reduce((a, b) => a + b, 0)

  const filtered = issues.filter(i => {
    const sevMatch = filter === "all" || i.severity === filter
    const typeMatch = typeFilter === "all" || i.type === typeFilter
    return sevMatch && typeMatch
  })

  const gradeColor = getScoreColor(data.overall_score || 0)

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00d9a3] animate-pulse" />
          <span className="font-mono text-sm" style={{ color: "#a0a0a0" }}>Review complete</span>
          {prInfo?.url && (
            <a href={prInfo.url} target="_blank" rel="noopener noreferrer"
               className="font-mono text-xs hover:underline" style={{ color: "#00d9a3" }}>
              View PR ↗
            </a>
          )}
        </div>
        <button onClick={onReset} className="btn-secondary text-xs">← New Review</button>
      </div>

      {/* PR Info */}
      {prInfo && (
        <div className="card p-4 gradient-border animate-fade-in-up-delay-1">
          <div className="flex items-start gap-4 flex-wrap">
            {prInfo.avatar && (
              <img src={prInfo.avatar} alt={prInfo.author}
                className="w-10 h-10 rounded-full" style={{ border: "1px solid #4a4a4a" }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-sans font-semibold truncate" style={{ color: "#f0f0f0" }}>{prInfo.title}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {prInfo.author && <span className="font-mono text-xs" style={{ color: "#6b6b6b" }}>@{prInfo.author}</span>}
                {prInfo.base && prInfo.head && (
                  <span className="font-mono text-xs" style={{ color: "#6b6b6b" }}>
                    <span style={{ color: "#a0a0a0" }}>{prInfo.base}</span> ← <span style={{ color: "#00d9a3" }}>{prInfo.head}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span style={{ color: "#6b6b6b" }}>{prInfo.changed_files} files</span>
              <span style={{ color: "#00d9a3" }}>+{prInfo.additions}</span>
              <span style={{ color: "#808080" }}>-{prInfo.deletions}</span>
            </div>
          </div>
        </div>
      )}

      {/* Score + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up-delay-2">
        <div className="card p-6 flex flex-col items-center gap-3">
          <ScoreRing score={data.overall_score || 0} />
          <div className="text-center">
            <p className="font-mono text-4xl font-bold" style={{ color: gradeColor }}>{data.grade || "?"}</p>
            <p className="font-mono text-xs mt-1" style={{ color: "#6b6b6b" }}>Overall Grade</p>
          </div>
        </div>
        <div className="card p-5 md:col-span-2 flex flex-col justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider mb-2" style={{ color: "#6b6b6b" }}>AI Summary</p>
            <p className="text-sm leading-relaxed" style={{ color: "#a0a0a0" }}>{data.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricBar label="Bugs"        value={metrics.bugs || 0}          max={Math.max(totalIssues,1)} color="#f0f0f0" />
            <MetricBar label="Security"    value={metrics.security || 0}      max={Math.max(totalIssues,1)} color="#d0d0d0" />
            <MetricBar label="Performance" value={metrics.performance || 0}   max={Math.max(totalIssues,1)} color="#a0a0a0" />
            <MetricBar label="Code Smells" value={metrics.code_smells || 0}   max={Math.max(totalIssues,1)} color="#808080" />
          </div>
        </div>
      </div>

      {/* Severity stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-up-delay-3">
        {["critical","high","medium","low","info"].map(sev => {
          const count = issues.filter(i => i.severity === sev).length
          const s = SEVERITY[sev]
          return (
            <button key={sev}
              onClick={() => setFilter(filter === sev ? "all" : sev)}
              className="card p-3 text-center transition-all duration-200"
              style={filter === sev ? { borderColor: s.border, background: s.bg } : {}}>
              <p className="font-mono text-xl font-bold" style={{ color: s.color }}>{count}</p>
              <p className="font-mono text-xs mt-1" style={{ color: "#6b6b6b" }}>{s.label}</p>
            </button>
          )
        })}
      </div>

      {/* Positives */}
      {positives.length > 0 && (
        <div className="card p-4 animate-fade-in-up-delay-4"
          style={{ borderColor: "rgba(0,217,163,0.2)" }}>
          <p className="font-mono text-xs uppercase tracking-wider mb-3" style={{ color: "#00d9a3" }}>✓ Strengths</p>
          <div className="space-y-1.5">
            {positives.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "#a0a0a0" }}>
                <span style={{ color: "#00d9a3" }} className="mt-0.5 shrink-0">●</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      <div className="animate-fade-in-up-delay-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-sans font-bold" style={{ color: "#f0f0f0" }}>Issues</h2>
            <span className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ background: "#2d2d2d", color: "#6b6b6b" }}>
              {filtered.length} / {issues.length}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTypeFilter("all")}
              className="font-mono text-xs px-3 py-1.5 rounded border transition-all"
              style={typeFilter === "all"
                ? { borderColor: "rgba(0,217,163,0.4)", color: "#00d9a3", background: "rgba(0,217,163,0.1)" }
                : { borderColor: "#4a4a4a", color: "#6b6b6b" }}>
              All
            </button>
            {Object.entries(TYPE_META).map(([key, meta]) =>
              issues.some(i => i.type === key) && (
                <button key={key}
                  onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
                  className="font-mono text-xs px-3 py-1.5 rounded border transition-all flex items-center gap-1"
                  style={typeFilter === key
                    ? { borderColor: `${meta.color}60`, color: meta.color, background: `${meta.color}15` }
                    : { borderColor: "#4a4a4a", color: "#6b6b6b" }}>
                  <span>{meta.icon}</span> {meta.label}
                </button>
              )
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-mono text-sm" style={{ color: "#6b6b6b" }}>No issues match current filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue, idx) => (
              <IssueCard key={issue.id || idx} issue={issue} idx={idx} />
            ))}
          </div>
        )}
      </div>

      {/* Files */}
      {prInfo?.files?.length > 0 && (
        <div className="card p-4">
          <p className="font-mono text-xs uppercase tracking-wider mb-3" style={{ color: "#6b6b6b" }}>Files Reviewed</p>
          <div className="space-y-2">
            {prInfo.files.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs truncate flex-1" style={{ color: "#a0a0a0" }}>{f.name}</span>
                <div className="flex gap-3 font-mono text-xs shrink-0 ml-3">
                  <span style={{ color: "#00d9a3" }}>+{f.additions}</span>
                  <span style={{ color: "#808080" }}>-{f.deletions}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Input Panel ───────────────────────────────────────────────────────────────
function InputPanel({ onResults, onLoading }) {
  const [inputMode, setInputMode] = useState("github")
  const [prUrl, setPrUrl] = useState("")
  const [ghToken, setGhToken] = useState("")
  const [code, setCode] = useState("")
  const [filename, setFilename] = useState("")
  const [language, setLanguage] = useState("auto")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(""); setLoading(true); onLoading(true)
    try {
      let res
      if (inputMode === "github") {
        if (!prUrl.trim()) { setError("Please enter a GitHub PR URL"); setLoading(false); onLoading(false); return }
        res = await axios.post(`${API}/review/github`, { pr_url: prUrl.trim(), github_token: ghToken.trim() })
      } else {
        if (!code.trim()) { setError("Please paste some code"); setLoading(false); onLoading(false); return }
        res = await axios.post(`${API}/review/code`, { code: code.trim(), language: language || "auto", filename: filename.trim() || "snippet" })
      }
      onResults(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Something went wrong")
      onLoading(false)
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid #4a4a4a" }}>
        {[["github","🔗 GitHub PR"],["code","📄 Paste Code"]].map(([key, label]) => (
          <button key={key}
            onClick={() => { setInputMode(key); setError("") }}
            className={`font-mono text-sm px-5 py-3 transition-all duration-200 ${inputMode === key ? "tab-active" : "tab-inactive"}`}>
            {label}
          </button>
        ))}
      </div>

      {inputMode === "github" && (
        <div className="space-y-4 animate-fade-in-up">
          <div>
            <label className="font-mono text-xs uppercase tracking-wider block mb-2" style={{ color: "#6b6b6b" }}>
              GitHub PR URL <span style={{ color: "#c0392b" }}>*</span>
            </label>
            <input className="input-field" placeholder="https://github.com/owner/repo/pull/123"
              value={prUrl} onChange={e => setPrUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <div>
            <label className="font-mono text-xs uppercase tracking-wider block mb-2" style={{ color: "#6b6b6b" }}>
              GitHub Token <span style={{ color: "#4a4a4a" }}>(optional · private repos)</span>
            </label>
            <input className="input-field" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={ghToken} onChange={e => setGhToken(e.target.value)} />
          </div>
        </div>
      )}

      {inputMode === "code" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-xs uppercase tracking-wider block mb-2" style={{ color: "#6b6b6b" }}>Filename</label>
              <input className="input-field" placeholder="main.py" value={filename} onChange={e => setFilename(e.target.value)} />
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-wider block mb-2" style={{ color: "#6b6b6b" }}>Language</label>
              <select className="input-field" value={language} onChange={e => setLanguage(e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="font-mono text-xs uppercase tracking-wider block mb-2" style={{ color: "#6b6b6b" }}>
              Code <span style={{ color: "#c0392b" }}>*</span>
            </label>
            <textarea className="input-field font-mono text-xs resize-none leading-relaxed" rows={12}
              placeholder="Paste your code here..."
              value={code} onChange={e => setCode(e.target.value)} />
            <p className="font-mono text-xs mt-1" style={{ color: "#4a4a4a" }}>{code.length.toLocaleString()} chars</p>
          </div>
        </div>
      )}

      {error && (
        <div className="card p-3" style={{ borderColor: "#4a4a4a", background: "#333333" }}>
          <p className="font-mono text-xs" style={{ color: "#f0f0f0" }}>⚠ {error}</p>
        </div>
      )}

      <button className="btn-primary w-full text-base" onClick={handleSubmit} disabled={loading}>
        {loading ? "Analyzing..." : "→ Run AI Review"}
      </button>

      <div>
        <p className="font-mono text-xs mb-2" style={{ color: "#4a4a4a" }}>Try a public PR:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "React #30249", url: "https://github.com/facebook/react/pull/30249" },
            { label: "Axios #6186",  url: "https://github.com/axios/axios/pull/6186" },
            { label: "FastAPI #2027",url: "https://github.com/tiangolo/fastapi/pull/2027" },
          ].map(ex => (
            <button key={ex.url}
              onClick={() => { setPrUrl(ex.url); setInputMode("github") }}
              className="font-mono text-xs px-3 py-1.5 rounded border transition-all duration-200"
              style={{ color: "#a0a0a0", borderColor: "#4a4a4a" }}
              onMouseOver={e => e.currentTarget.style.borderColor = "rgba(0,217,163,0.3)"}
              onMouseOut={e => e.currentTarget.style.borderColor = "#4a4a4a"}>
              {ex.label} ↗
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header() {
  return (
    <header style={{ borderBottom: "1px solid #4a4a4a", background: "rgba(26,26,26,0.9)" }}
      className="backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(0,217,163,0.1)", border: "1px solid rgba(0,217,163,0.2)" }}>
            <span className="text-base">🛡</span>
          </div>
          <div>
            <span className="font-sans font-bold text-lg" style={{ color: "#f0f0f0" }}>CodeSentinel</span>
            <span className="font-mono text-xs ml-2" style={{ color: "#4a4a4a" }}>v1.0</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00d9a3] animate-pulse" />
            <span className="font-mono text-xs" style={{ color: "#6b6b6b" }}>AI Online</span>
          </div>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="font-mono text-xs px-3 py-1.5 rounded border transition-all duration-200"
            style={{ color: "#6b6b6b", borderColor: "#4a4a4a" }}>
            GitHub
          </a>
        </div>
      </div>
    </header>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <div className="text-center py-16 px-4 space-y-6 relative z-10">
      <div className="inline-flex items-center gap-2 font-mono text-xs px-4 py-2 rounded-full"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#00FFB2" }}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#00FFB2] animate-pulse" />
        Powered by Gemini 2.5 Flash
      </div>
      <h1 className="font-sans font-extrabold text-5xl sm:text-7xl leading-tight tracking-tight">
        <span className="bg-gradient-to-r from-[#F5F5F5] via-[#E0E0E0] to-[#A0A0A0] bg-clip-text text-transparent">AI Code Review</span>
        <br />
        <span className="bg-gradient-to-r from-[#00FFB2] to-[#00E5FF] bg-clip-text text-transparent text-glow">in Seconds</span>
      </h1>
      <p className="text-base sm:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: "#a0a0a0" }}>
        Paste a Pull Request URL or raw code. Receive an instant futuristic AI review
        that detects logical flaws, performance bottlenecks, and security exploits instantly.
      </p>
      <div className="flex justify-center gap-4 font-mono text-xs flex-wrap" style={{ color: "#6b6b6b" }}>
        {["🐛 Bugs","🔐 Security","⚡ Performance","🔴 Code Smells"].map(t => (
          <span key={t} className="px-3 py-1.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">{t}</span>
        ))}
      </div>
    </div>
  )
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("input")
  const [results, setResults] = useState(null)

  function handleResults(data) { setResults(data); setView("results") }
  function handleLoading(v) { if (v) setView("loading") }
  function handleReset() { setResults(null); setView("input") }

  return (
    <div className="min-h-screen bg-grid relative overflow-hidden">
      {/* Premium Apple Vision Pro Backdrop Spheres */}
      <div className="fixed top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#00FFB2] opacity-[0.03] blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-[#00E5FF] opacity-[0.03] blur-[120px] pointer-events-none z-0" />
      <div className="fixed top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#6b6b6b] opacity-[0.02] blur-[150px] pointer-events-none z-0" />

      <div className="scan-line" />
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 relative z-10">
        {view !== "results" && <Hero />}
        <div className={view === "results" ? "pt-6" : ""}>
          {view === "input"   && <InputPanel onResults={handleResults} onLoading={handleLoading} />}
          {view === "loading" && <LoadingScreen />}
          {view === "results" && results && <ResultsDashboard data={results} onReset={handleReset} />}
        </div>
      </main>
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} className="py-6 mt-8 relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-3">
          <span className="font-mono text-xs" style={{ color: "#4a4a4a" }}>CodeSentinel · AI Code Review Agent</span>
          <span className="font-mono text-xs" style={{ color: "#3a3a3a" }}>Built with Gemini AI + FastAPI + React</span>
        </div>
      </footer>
    </div>
  )
}
