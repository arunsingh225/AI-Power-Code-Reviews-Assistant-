import { useState, useRef, useEffect } from "react"
import axios from "axios"

const API = "/api"

// ─── Constants ───────────────────────────────────────────────────────────────

const SEVERITY = {
  critical: { color: "#ff3b5c", bg: "rgba(255,59,92,0.12)", border: "rgba(255,59,92,0.3)", label: "CRITICAL" },
  high:     { color: "#ff6b35", bg: "rgba(255,107,53,0.12)", border: "rgba(255,107,53,0.3)", label: "HIGH" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "MEDIUM" },
  low:      { color: "#00d9a3", bg: "rgba(0,217,163,0.10)", border: "rgba(0,217,163,0.3)", label: "LOW" },
  info:     { color: "#7c8dff", bg: "rgba(124,141,255,0.10)", border: "rgba(124,141,255,0.3)", label: "INFO" },
}

const TYPE_META = {
  bug:           { icon: "🐛", label: "Bug",           color: "#ff3b5c" },
  security:      { icon: "🔐", label: "Security",      color: "#ff6b35" },
  performance:   { icon: "⚡", label: "Performance",   color: "#f59e0b" },
  code_smell:    { icon: "🔴", label: "Code Smell",    color: "#a78bfa" },
  best_practice: { icon: "📋", label: "Best Practice", color: "#4f9cf9" },
}

const LANGUAGES = [
  "auto","python","javascript","typescript","java","go","rust","c","cpp",
  "csharp","php","ruby","swift","kotlin","sql","bash","yaml","json",
]

function getScoreClass(score) {
  if (score >= 85) return "score-excellent"
  if (score >= 70) return "score-good"
  if (score >= 50) return "score-fair"
  if (score >= 30) return "score-poor"
  return "score-critical"
}

function getScoreColor(score) {
  if (score >= 85) return "#00d9a3"
  if (score >= 70) return "#4f9cf9"
  if (score >= 50) return "#f59e0b"
  if (score >= 30) return "#ff6b35"
  return "#ff3b5c"
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const radius = 54
  const circ = 2 * Math.PI * radius
  const dash = (score / 100) * circ
  const color = getScoreColor(score)

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg width="144" height="144" className="block">
          <circle cx="72" cy="72" r={radius} fill="none" stroke="#1e2d45" strokeWidth="10" />
          <circle
            cx="72" cy="72" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className="score-ring transition-all duration-1000"
            style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-3xl" style={{ color }}>{score}</span>
          <span className="font-mono text-xs text-slate-500">/100</span>
        </div>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] || SEVERITY.info
  return (
    <span
      className="severity-badge"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  )
}

function TypeBadge({ type }) {
  const t = TYPE_META[type] || { icon: "📌", label: type, color: "#7c8dff" }
  return (
    <span className="flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded"
      style={{ color: t.color, backgroundColor: `${t.color}15` }}>
      <span>{t.icon}</span>
      <span>{t.label}</span>
    </span>
  )
}

function IssueCard({ issue, idx }) {
  const [expanded, setExpanded] = useState(false)
  const s = SEVERITY[issue.severity] || SEVERITY.info

  return (
    <div
      className="issue-card animate-fade-in-up"
      style={{ animationDelay: `${idx * 0.05}s`, borderLeft: `3px solid ${s.color}` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={issue.severity} />
          <TypeBadge type={issue.type} />
          {issue.file && issue.file !== "general" && (
            <span className="font-mono text-xs text-slate-500 bg-bg-secondary px-2 py-0.5 rounded">
              {issue.file}{issue.line ? `:${issue.line}` : ""}
            </span>
          )}
        </div>
        <span className="text-slate-600 text-sm shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>

      <p className="font-sans font-medium text-slate-200 mt-2 text-sm">{issue.title}</p>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-bg-border pt-3">
          <div>
            <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Issue</p>
            <p className="text-sm text-slate-300 font-body leading-relaxed">{issue.description}</p>
          </div>
          {issue.suggestion && (
            <div>
              <p className="font-mono text-xs text-accent-green uppercase tracking-wider mb-1">💡 Suggestion</p>
              <p className="text-sm text-slate-300 font-body leading-relaxed whitespace-pre-wrap">{issue.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricBar({ label, value, max, color }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-slate-400">{label}</span>
        <span className="font-mono text-xs font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
        />
      </div>
    </div>
  )
}

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
      {/* Animated logo */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full border-2 border-accent-green/20 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-t-accent-green border-r-accent-green/40 border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl">🔍</span>
          </div>
        </div>
        <div className="absolute -inset-2 rounded-full bg-accent-green/5 animate-pulse-slow" />
      </div>

      <div className="text-center space-y-3">
        <h3 className="font-sans font-bold text-xl text-slate-200">Analyzing Code</h3>
        <p className="terminal-text cursor-blink">{steps[step]}</p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= step ? "#00d9a3" : "#1e2d45", boxShadow: i === step ? "0 0 6px #00d9a3" : "none" }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Results Dashboard ────────────────────────────────────────────────────────

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

  const grade = data.grade || "?"
  const gradeColor = getScoreColor(data.overall_score || 0)

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          <span className="font-mono text-sm text-slate-400">Review complete</span>
          {prInfo?.url && (
            <a href={prInfo.url} target="_blank" rel="noopener noreferrer"
               className="font-mono text-xs text-accent-blue hover:underline flex items-center gap-1">
              View PR ↗
            </a>
          )}
        </div>
        <button onClick={onReset} className="btn-secondary text-xs">
          ← New Review
        </button>
      </div>

      {/* PR Info banner */}
      {prInfo && (
        <div className="card p-4 gradient-border animate-fade-in-up-delay-1">
          <div className="flex items-start gap-4 flex-wrap">
            {prInfo.avatar && (
              <img src={prInfo.avatar} alt={prInfo.author} className="w-10 h-10 rounded-full border border-bg-border" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-sans font-semibold text-slate-100 truncate">{prInfo.title}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {prInfo.author && <span className="font-mono text-xs text-slate-500">@{prInfo.author}</span>}
                {prInfo.base && prInfo.head && (
                  <span className="font-mono text-xs text-slate-600">
                    <span className="text-slate-400">{prInfo.base}</span> ← <span className="text-accent-green">{prInfo.head}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="text-slate-500">{prInfo.changed_files} files</span>
              <span className="text-emerald-400">+{prInfo.additions}</span>
              <span className="text-red-400">-{prInfo.deletions}</span>
            </div>
          </div>
        </div>
      )}

      {/* Score + Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up-delay-2">
        {/* Score card */}
        <div className="card p-6 flex flex-col items-center gap-3">
          <ScoreRing score={data.overall_score || 0} />
          <div className="text-center">
            <p className="font-mono text-4xl font-bold" style={{ color: gradeColor }}>{grade}</p>
            <p className="font-mono text-xs text-slate-500 mt-1">Overall Grade</p>
          </div>
        </div>

        {/* Summary */}
        <div className="card p-5 md:col-span-2 flex flex-col justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-2">AI Summary</p>
            <p className="text-sm text-slate-300 leading-relaxed font-body">{data.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricBar label="Bugs" value={metrics.bugs || 0} max={Math.max(totalIssues, 1)} color="#ff3b5c" />
            <MetricBar label="Security" value={metrics.security || 0} max={Math.max(totalIssues, 1)} color="#ff6b35" />
            <MetricBar label="Performance" value={metrics.performance || 0} max={Math.max(totalIssues, 1)} color="#f59e0b" />
            <MetricBar label="Code Smells" value={metrics.code_smells || 0} max={Math.max(totalIssues, 1)} color="#a78bfa" />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-up-delay-3">
        {Object.entries({ critical: "critical", high: "high", medium: "medium", low: "low", info: "info" }).map(([sev]) => {
          const count = issues.filter(i => i.severity === sev).length
          const s = SEVERITY[sev]
          return (
            <button
              key={sev}
              onClick={() => setFilter(filter === sev ? "all" : sev)}
              className={`card p-3 text-center transition-all duration-200 hover:border-opacity-60 ${filter === sev ? "ring-1" : ""}`}
              style={{ ringColor: s.color, borderColor: filter === sev ? s.border : undefined }}
            >
              <p className="font-mono text-xl font-bold" style={{ color: s.color }}>{count}</p>
              <p className="font-mono text-xs text-slate-500 mt-1">{s.label}</p>
            </button>
          )
        })}
      </div>

      {/* Positives */}
      {positives.length > 0 && (
        <div className="card p-4 border-accent-green/20 animate-fade-in-up-delay-4">
          <p className="font-mono text-xs text-accent-green uppercase tracking-wider mb-3">✓ Strengths</p>
          <div className="space-y-1.5">
            {positives.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-300 font-body">
                <span className="text-accent-green mt-0.5 shrink-0">●</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues section */}
      <div className="animate-fade-in-up-delay-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-sans font-bold text-slate-200">Issues</h2>
            <span className="font-mono text-xs bg-bg-secondary text-slate-400 px-2 py-0.5 rounded">
              {filtered.length} / {issues.length}
            </span>
          </div>

          {/* Type filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTypeFilter("all")}
              className={`font-mono text-xs px-3 py-1.5 rounded border transition-all ${typeFilter === "all" ? "border-accent-green/50 text-accent-green bg-accent-green/10" : "border-bg-border text-slate-500 hover:text-slate-300"}`}
            >
              All
            </button>
            {Object.entries(TYPE_META).map(([key, meta]) => (
              issues.some(i => i.type === key) && (
                <button
                  key={key}
                  onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
                  className={`font-mono text-xs px-3 py-1.5 rounded border transition-all flex items-center gap-1 ${typeFilter === key ? "border-opacity-50 bg-opacity-10" : "border-bg-border text-slate-500 hover:text-slate-300"}`}
                  style={typeFilter === key ? { borderColor: `${meta.color}80`, color: meta.color, backgroundColor: `${meta.color}15` } : {}}
                >
                  <span>{meta.icon}</span> {meta.label}
                </button>
              )
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-500 font-mono text-sm">No issues match current filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue, idx) => (
              <IssueCard key={issue.id || idx} issue={issue} idx={idx} />
            ))}
          </div>
        )}
      </div>

      {/* Files changed */}
      {prInfo?.files?.length > 0 && (
        <div className="card p-4">
          <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-3">Files Reviewed</p>
          <div className="space-y-2">
            {prInfo.files.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-slate-400 truncate flex-1">{f.name}</span>
                <div className="flex gap-3 font-mono text-xs shrink-0 ml-3">
                  <span className="text-emerald-400">+{f.additions}</span>
                  <span className="text-red-400">-{f.deletions}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Input Panel ──────────────────────────────────────────────────────────────

function InputPanel({ onResults, onLoading }) {
  const [inputMode, setInputMode] = useState("github") // github | code
  const [prUrl, setPrUrl] = useState("")
  const [ghToken, setGhToken] = useState("")
  const [code, setCode] = useState("")
  const [filename, setFilename] = useState("")
  const [language, setLanguage] = useState("auto")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError("")
    setLoading(true)
    onLoading(true)

    try {
      let res
      if (inputMode === "github") {
        if (!prUrl.trim()) { setError("Please enter a GitHub PR URL"); setLoading(false); onLoading(false); return }
        res = await axios.post(`${API}/review/github`, { pr_url: prUrl.trim(), github_token: ghToken.trim() })
      } else {
        if (!code.trim()) { setError("Please paste some code"); setLoading(false); onLoading(false); return }
        res = await axios.post(`${API}/review/code`, {
          code: code.trim(),
          language: language || "auto",
          filename: filename.trim() || "snippet",
        })
      }
      onResults(res.data)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Something went wrong"
      setError(msg)
      onLoading(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">

      {/* Tabs */}
      <div className="flex border-b border-bg-border">
        {[["github", "🔗 GitHub PR"], ["code", "📄 Paste Code"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setInputMode(key); setError("") }}
            className={`font-mono text-sm px-5 py-3 transition-all duration-200 ${inputMode === key ? "tab-active" : "tab-inactive"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* GitHub form */}
      {inputMode === "github" && (
        <div className="space-y-4 animate-fade-in-up">
          <div>
            <label className="font-mono text-xs text-slate-500 uppercase tracking-wider block mb-2">
              GitHub PR URL <span className="text-red-400">*</span>
            </label>
            <input
              className="input-field"
              placeholder="https://github.com/owner/repo/pull/123"
              value={prUrl}
              onChange={e => setPrUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div>
            <label className="font-mono text-xs text-slate-500 uppercase tracking-wider block mb-2">
              GitHub Token <span className="text-slate-600">(optional · for private repos)</span>
            </label>
            <input
              className="input-field"
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={ghToken}
              onChange={e => setGhToken(e.target.value)}
            />
            <p className="font-mono text-xs text-slate-600 mt-1.5">
              Public repos work without a token. Token needs <code className="text-slate-500">repo</code> scope.
            </p>
          </div>
        </div>
      )}

      {/* Code form */}
      {inputMode === "code" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-xs text-slate-500 uppercase tracking-wider block mb-2">Filename</label>
              <input
                className="input-field"
                placeholder="main.py"
                value={filename}
                onChange={e => setFilename(e.target.value)}
              />
            </div>
            <div>
              <label className="font-mono text-xs text-slate-500 uppercase tracking-wider block mb-2">Language</label>
              <select
                className="input-field"
                value={language}
                onChange={e => setLanguage(e.target.value)}
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="font-mono text-xs text-slate-500 uppercase tracking-wider block mb-2">
              Code <span className="text-red-400">*</span>
            </label>
            <textarea
              className="input-field font-mono text-xs resize-none leading-relaxed"
              rows={12}
              placeholder="Paste your code here..."
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <p className="font-mono text-xs text-slate-600 mt-1">{code.length.toLocaleString()} chars</p>
          </div>
        </div>
      )}

      {error && (
        <div className="card p-3 border-red-500/30 bg-red-500/5">
          <p className="font-mono text-xs text-red-400">⚠ {error}</p>
        </div>
      )}

      <button
        className="btn-primary w-full text-base"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? "Analyzing..." : "→ Run AI Review"}
      </button>

      {/* Example PRs */}
      <div>
        <p className="font-mono text-xs text-slate-600 mb-2">Try a public PR example:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "React #30249", url: "https://github.com/facebook/react/pull/30249" },
            { label: "Axios #6186",  url: "https://github.com/axios/axios/pull/6186" },
          ].map(ex => (
            <button
              key={ex.url}
              onClick={() => { setPrUrl(ex.url); setInputMode("github") }}
              className="font-mono text-xs text-accent-blue hover:text-accent-green border border-bg-border hover:border-accent-green/30 px-3 py-1.5 rounded transition-all duration-200"
            >
              {ex.label} ↗
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b border-bg-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
            <span className="text-base">🛡</span>
          </div>
          <div>
            <span className="font-sans font-bold text-slate-100 text-lg">CodeSentinel</span>
            <span className="font-mono text-xs text-slate-600 ml-2">v1.0</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <span className="font-mono text-xs text-slate-500">AI Online</span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-slate-500 hover:text-slate-300 border border-bg-border hover:border-slate-600 px-3 py-1.5 rounded transition-all duration-200"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <div className="text-center py-12 px-4 space-y-5">
      <div className="inline-flex items-center gap-2 bg-accent-green/10 border border-accent-green/20 text-accent-green font-mono text-xs px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
        Powered by Claude AI
      </div>
      <h1 className="font-sans font-extrabold text-4xl sm:text-5xl text-slate-100 leading-tight">
        AI Code Review
        <br />
        <span className="text-glow" style={{ color: "#00d9a3" }}>in Seconds</span>
      </h1>
      <p className="font-body text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
        Paste a GitHub PR URL or your code. Get instant AI-powered reviews that catch bugs,
        security issues, and performance problems before they ship.
      </p>
      <div className="flex justify-center gap-6 font-mono text-xs text-slate-500">
        {["🐛 Bugs", "🔐 Security", "⚡ Performance", "🔴 Code Smells"].map(t => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("input") // input | loading | results
  const [results, setResults] = useState(null)

  function handleResults(data) {
    setResults(data)
    setView("results")
  }

  function handleLoading(isLoading) {
    if (isLoading) setView("loading")
  }

  function handleReset() {
    setResults(null)
    setView("input")
  }

  return (
    <div className="min-h-screen bg-grid">
      <div className="scan-line" />
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {view !== "results" && <Hero />}

        <div className={view === "results" ? "pt-6" : ""}>
          {view === "input"   && <InputPanel onResults={handleResults} onLoading={handleLoading} />}
          {view === "loading" && <LoadingScreen />}
          {view === "results" && results && <ResultsDashboard data={results} onReset={handleReset} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-bg-border py-6 mt-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-3">
          <span className="font-mono text-xs text-slate-600">CodeSentinel · AI Code Review Agent</span>
          <span className="font-mono text-xs text-slate-700">Built with Claude AI + FastAPI + React</span>
        </div>
      </footer>
    </div>
  )
}
