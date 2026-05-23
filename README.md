# CodeSentinel 🛡️

> AI-powered code review agent — instant bug, security & performance analysis using Claude AI.

## Stack
- **Backend**: FastAPI + Claude Sonnet 4 + httpx (Python)
- **Frontend**: React + Vite + Tailwind CSS

## Quick Start

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # Add your ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev                 # Opens http://localhost:5173
```

## Features
- 🔗 Review GitHub PRs by URL (public or private with token)
- 📄 Review raw code snippets (18+ languages)
- 🎯 Animated score ring + letter grade (A–F)
- 📊 Per-category metrics (bugs, security, performance, code smells)
- 🔍 Expandable issue cards with severity + type badges
- ✅ Strengths / positives panel
- 🕐 Review history (localStorage, last 20 reviews)
- ↓ Export review as Markdown
- 🌙 Dark IDE theme with scan-line animations

## API
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/review/github` | Review a GitHub PR |
| POST | `/api/review/code` | Review raw code |
| GET  | `/health` | Health check |
