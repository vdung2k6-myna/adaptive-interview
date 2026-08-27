# Adaptive Interview Engine

An AI-powered technical interview platform that generates personalized, context-aware interview questions in real time, evaluates candidates with structured AI scoring, and provides a recruiter dashboard for review and calibration.

This repository contains the **Next.js frontend**. The API backend lives in the separate [`adaptive-interview-api`](https://github.com/vdung2k6-myna/adaptive-interview-api) repository.

> **📌 Keep docs in sync:** This README must be updated whenever features, routes, schema, or scripts change. See [`CLAUDE.md`](CLAUDE.md) for the documentation requirements checklist.

---

## Features

- **Adaptive AI Interviewer** — Each question is generated on-the-fly based on the candidate's skills, experience, CV, and the position's requirements
- **CV-Aware Prompting** — Paste a candidate's full resume; the AI uses it to ask deeply relevant questions
- **Job Description Support** — Attach a long-form job description to any position for richer AI context during interviews and evaluations
- **Real-Time Streaming** — Interviewer responses stream token-by-token from the backend via Ollama's `stream: true`
- **Rich Markdown Rendering** — Interviewer messages render Markdown (bold, lists, code blocks) with syntax highlighting via `highlight.js` and safe HTML via `DOMPurify`
- **Semantic Topic Tracking** — Vector embeddings (pgvector) in the backend track which position requirements have been covered
- **Turn-Based Sessions** — Configurable max turns per interview (default: 8). Auto-completes when the limit is reached
- **AI Evaluation** — Post-interview structured scoring across 4 dimensions with strengths, weaknesses, and a hire recommendation
- **Human Calibration** — Recruiters can override AI scores, adjust recommendations, and leave notes. All versions are preserved
- **Recruiter Dashboard** — Centralized view of all sessions with status filters, search, stats cards, and color-coded recommendation badges
- **Side-by-Side Comparison** — Compare two candidates' evaluations on `/compare?a=[id]&b=[id]`
- **Anonymous Session Links** — Share an interview via a unique UUID URL. Copy link buttons on Dashboard and Transcript pages
- **Position & Candidate Management** — Create, list, edit, and delete positions and candidates (edit/delete blocked if the entity is already in use by a session)
- **Recruiting Campaigns** — Group positions into campaigns with aggregated metrics: sessions, completion rate, score averages, recommendation distribution, and top candidates
- **Voice Interviews** — Optional turn-based voice mode: candidates record answers via microphone; the backend transcribes via audio.cpp (STT) and speaks back via TTS. Supports **Kokoro** (default) and **Piper**
- **Mobile-First Responsive UI** — All admin, setup, and interview pages adapt down to 375px wide. Tables become card lists on phones, touch targets are ≥44×44px, and form inputs use `text-base` to prevent iOS Safari auto-zoom
- **PWA Installability (Android)** — Add-to-home-screen support with a Web App Manifest, service worker, offline fallback, and standalone display mode for chromeless voice interviews
- **MCP Analytics Server** — External AI clients can query anonymized interview data via MCP protocol. Implemented in the backend at `/api/mcp`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 |
| State | React `useState` / `useRef` (no global store) |
| HTTP | `fetch` via `apiFetch()` wrapper |
| Markdown | `marked` + `highlight.js` + `DOMPurify` |
| Fonts | Geist (Sans + Mono) |

The backend uses Express, Drizzle ORM, PostgreSQL + pgvector, and Ollama. See the backend repo for its stack details.

---

## Architecture

The frontend is a **pure presentation layer**. All API calls go to the standalone Express backend (`adaptive-interview-api`, port `4000`). During development, `next.config.ts` rewrites proxy `/api/*` and `/audio/*` to the backend.

```
┌─────────────────────────────────────────────┐
│  Next.js Frontend (port 3000)               │
│  Pages, Components, Hooks, Styles            │
│  All data fetched via apiFetch()            │
└─────────────────────┬───────────────────────┘
                      │
          fetch() / apiFetch()
                      │
┌─────────────────────┴───────────────────────┐
│  Next.js Rewrites (dev proxy)               │
│  /api/*  → http://localhost:4000/api/*      │
│  /audio/* → http://localhost:4000/audio/*  │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────┴───────────────────────┐
│  Express Backend (port 4000)                │
│  /api/* routes, /audio/* serving, Ollama,   │
│  PostgreSQL, audio services                 │
└─────────────────────────────────────────────┘
```

### Frontend File Organization

```
src/
├── app/                          # Next.js App Router (pages)
│   ├── candidates/               # Candidate list + forms (Client Components)
│   ├── campaigns/                # Campaign list + detail + forms (Client Components)
│   ├── compare/                  # Side-by-side comparison (Client Component)
│   ├── dashboard/                # Recruiter dashboard (Client Component)
│   ├── interview/[id]/           # Live interview chat (Client Component)
│   │   ├── voice/                # Voice interview page (Client Component)
│   │   └── transcript/           # Transcript + evaluation (Client Component)
│   ├── positions/                # Position list + forms (Client Components)
│   ├── setup/                    # Interview setup (Client Component)
│   ├── error.tsx                 # Global error boundary
│   ├── globals.css               # Tailwind + Markdown + syntax styles
│   ├── layout.tsx                # Root layout with nav + fonts + PWA registration
│   └── page.tsx                  # Landing → redirect to /dashboard
├── components/                   # Shared React components
│   ├── MarkdownRenderer.tsx      # Rich Markdown with syntax highlighting
│   ├── AudioPlayer.tsx           # HTML5 audio playback
│   ├── AudioRecorder.tsx         # Microphone capture + waveform
│   ├── StreamingAudioQueue.tsx   # Sentence-level audio queue
│   ├── ScoreInput.tsx            # Star score input
│   ├── ModelBadge.tsx            # Model name badge
│   ├── VersionHistory.tsx        # Evaluation version list
│   ├── DeleteButton.tsx          # Confirmation delete button
│   └── MobileNav.tsx             # Small-screen hamburger navigation
└── lib/                          # Frontend utilities only
    ├── api-client.ts             # Browser fetch wrapper with Bearer token injection
    ├── config/                   # Frontend environment config
    │   ├── index.ts                # Active config export
    │   ├── development.ts          # Dev settings
    │   └── production.ts           # Production settings
    ├── types.ts                  # Lightweight TypeScript interfaces
    └── audio/
        └── sentence-queue.ts     # Client-side sequential audio playback
```

The backend's route handlers, business logic, database schema, and audio services live in `adaptive-interview-api/`. See [backend docs](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md).

---

## API

All API endpoints are documented in the backend:

- **[Backend API Reference](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/API.md)**

The frontend calls these endpoints via `apiFetch()` from `@/lib/api-client`, which injects `Authorization: Bearer <token>` when `NEXT_PUBLIC_API_TOKEN` is set.

---

## Environment Variables

Create a `.env.local` file in the project root:

```bash
# API Authentication (only required when backend has API_AUTH_TOKEN configured)
NEXT_PUBLIC_API_TOKEN=your-secret-token-here
```

Database, Ollama, audio service, and MCP variables live in the backend's `.env`. See [backend setup](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md).

---

## Setup

### 1. Set up the backend first

The frontend cannot run without the backend.

- [Backend Setup Guide](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md)

### 2. Install frontend dependencies

```bash
cd adaptive-interview
npm install
```

### 3. Configure environment

Create `.env.local`:

```bash
# Only needed if backend has API_AUTH_TOKEN configured
NEXT_PUBLIC_API_TOKEN=your-secret-token-here
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Both the backend (port 4000) and frontend (port 3000) must be running.

---

## Usage Flow

### For Recruiters

1. **Dashboard** (`/dashboard`) — view all sessions, filter by status, search, click into transcripts, copy interview links
2. **Transcript** (`/interview/[id]/transcript`) — review Q/A, view AI evaluation, override with human scores, browse version history, copy link
3. **Compare** (`/compare?a=[id]&b=[id]`) — side-by-side candidate comparison
4. **Campaigns** (`/campaigns`) — manage hiring campaigns and view aggregated metrics
5. **Positions** (`/positions`) — manage positions (create, edit, delete if unused)
6. **Candidates** (`/candidates`) — manage candidates (create, edit, delete if unused)
7. **Setup** (`/setup`) — create a new interview by selecting a position + candidate

### For Candidates

1. **Interview** (`/interview/[id]`) — AI generates the first question immediately, streamed word-by-word
2. **Answer** — type a response, AI generates the next context-aware follow-up
3. **Completion** — after max turns (default 8), the interview ends and evaluation becomes available

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run dev:3001` | Start dev server on port 3001 |
| `npm run build` | Production build (outputs `.next/standalone/`) |
| `npm start` | Start production server from standalone bundle |
| `npm run lint` | ESLint check |

> **Tip:** To use any port: `npx next dev -p {port}`.

---

## Production Deployment

Because `next.config.ts` sets `output: "standalone"`, the build produces a self-contained server bundle.

### Build

```bash
npm run build
```

After the build completes, `npm run postbuild` runs automatically and copies `.next/static/` into `.next/standalone/.next/static/`.

### Start the standalone server

```bash
npm start
# or directly:
node .next/standalone/server.js
```

The server listens on port `3000` by default. Set `PORT` to override:

```bash
PORT=4000 node .next/standalone/server.js
```

### Deploy with PM2

```bash
npm run build
pm2 start .next/standalone/server.js --name interview-engine-ui
pm2 logs interview-engine-ui
```

---

## Documentation

- [`docs/API.md`](docs/API.md) — Link to backend API reference
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Frontend architecture and data flow
- [`docs/COMPONENTS.md`](docs/COMPONENTS.md) — React component inventory
- [`docs/DATABASE.md`](docs/DATABASE.md) — Database is backend-only
- [`docs/EVALUATION.md`](docs/EVALUATION.md) — Scoring and calibration
- [`docs/OLLAMA.md`](docs/OLLAMA.md) — Ollama integration from frontend perspective
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — Frontend optimization
- [`docs/SECURITY.md`](docs/SECURITY.md) — Security considerations
- [`docs/SETUP.md`](docs/SETUP.md) — Frontend setup
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — Feature history

Backend docs:

- [Backend Setup](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md)
- [Backend API Reference](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/API.md)
- [Backend Architecture](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md)

---

## License

MIT
