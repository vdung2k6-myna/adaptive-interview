# Adaptive Interview Engine

An AI-powered technical interview platform that generates personalized, context-aware interview questions in real time, evaluates candidates with structured AI scoring, and provides a recruiter dashboard for review and calibration.

This repository contains the **Next.js frontend**. The API backend lives in the separate [`adaptive-interview-api`](https://github.com/vdung2k6-myna/adaptive-interview-api) repository.

> **ðŸ“Œ Keep docs in sync:** This README must be updated whenever features, routes, schema, or scripts change. See [`CLAUDE.md`](CLAUDE.md) for the documentation requirements checklist.

---

## Features

- **Adaptive AI Interviewer** â€” Each question is generated on-the-fly based on the candidate's skills, experience, CV, and the position's requirements
- **CV-Aware Prompting** â€” Paste a candidate's full resume; the AI uses it to ask deeply relevant questions
- **Job Description Support** â€” Attach a long-form job description to any position for richer AI context during interviews and evaluations
- **Real-Time Streaming** â€” Interviewer responses stream token-by-token from the backend via Ollama's `stream: true`
- **Rich Markdown Rendering** â€” Interviewer messages render Markdown (bold, lists, code blocks) with syntax highlighting via `highlight.js` and safe HTML via `DOMPurify`
- **Semantic Topic Tracking** â€” Vector embeddings (pgvector) in the backend track which position requirements have been covered
- **Turn-Based Sessions** â€” Configurable max turns per interview (default: 8). Auto-completes when the limit is reached
- **AI Evaluation** â€” Post-interview structured scoring across 4 dimensions with strengths, weaknesses, and a hire recommendation
- **Human Calibration** â€” Recruiters can override AI scores, adjust recommendations, and leave notes. All versions are preserved
- **Recruiter Dashboard** â€” Centralized view of all sessions with status filters, search, stats cards, and color-coded recommendation badges
- **Side-by-Side Comparison** â€” Compare two candidates' evaluations on `/compare?a=[id]&b=[id]`
- **Anonymous Session Links** â€” Share an interview via a unique UUID URL. Copy link buttons on Dashboard and Transcript pages
- **Position & Candidate Management** â€” Create, list, edit, and delete positions and candidates (edit/delete blocked if the entity is already in use by a session)
- **Recruiting Campaigns** â€” Group positions into campaigns with aggregated metrics: sessions, completion rate, score averages, recommendation distribution, and top candidates
- **Voice Interviews** â€” Optional turn-based voice mode: candidates record answers via microphone; the backend transcribes via audio.cpp (STT) and speaks back via TTS. Supports **Kokoro** (default) and **Piper**
- **MCP Analytics Server** â€” External AI clients can query anonymized interview data via MCP protocol. Implemented in the backend at `/api/mcp`

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
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Next.js Frontend (port 3000)               â”‚
â”‚  Pages, Components, Hooks, Styles            â”‚
â”‚  All data fetched via apiFetch()            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                      â”‚
          fetch() / apiFetch()
                      â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Next.js Rewrites (dev proxy)               â”‚
â”‚  /api/*  â†’ http://localhost:4000/api/*      â”‚
â”‚  /audio/* â†’ http://localhost:4000/audio/*  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                      â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Express Backend (port 4000)                â”‚
â”‚  /api/* routes, /audio/* serving, Ollama,   â”‚
â”‚  PostgreSQL, audio services                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Frontend File Organization

```
src/
â”œâ”€â”€ app/                          # Next.js App Router (pages)
â”‚   â”œâ”€â”€ candidates/               # Candidate list + forms (Client Components)
â”‚   â”œâ”€â”€ campaigns/                # Campaign list + detail + forms (Client Components)
â”‚   â”œâ”€â”€ compare/                  # Side-by-side comparison (Client Component)
â”‚   â”œâ”€â”€ dashboard/                # Recruiter dashboard (Client Component)
â”‚   â”œâ”€â”€ interview/[id]/           # Live interview chat (Client Component)
â”‚   â”‚   â”œâ”€â”€ voice/                # Voice interview page (Client Component)
â”‚   â”‚   â””â”€â”€ transcript/           # Transcript + evaluation (Client Component)
â”‚   â”œâ”€â”€ positions/                # Position list + forms (Client Components)
â”‚   â”œâ”€â”€ setup/                    # Interview setup (Client Component)
â”‚   â”œâ”€â”€ error.tsx                 # Global error boundary
â”‚   â”œâ”€â”€ globals.css               # Tailwind + Markdown + syntax styles
â”‚   â”œâ”€â”€ layout.tsx                # Root layout with nav + fonts
â”‚   â””â”€â”€ page.tsx                  # Landing â†’ redirect to /dashboard
â”œâ”€â”€ components/                   # Shared React components
â”‚   â”œâ”€â”€ MarkdownRenderer.tsx      # Rich Markdown with syntax highlighting
â”‚   â”œâ”€â”€ AudioPlayer.tsx           # HTML5 audio playback
â”‚   â”œâ”€â”€ AudioRecorder.tsx         # Microphone capture + waveform
â”‚   â”œâ”€â”€ StreamingAudioQueue.tsx   # Sentence-level audio queue
â”‚   â”œâ”€â”€ ScoreInput.tsx            # Star score input
â”‚   â”œâ”€â”€ ModelBadge.tsx            # Model name badge
â”‚   â”œâ”€â”€ VersionHistory.tsx        # Evaluation version list
â”‚   â””â”€â”€ DeleteButton.tsx          # Confirmation delete button
â””â”€â”€ lib/                          # Frontend utilities only
    â”œâ”€â”€ api-client.ts             # Browser fetch wrapper with Bearer token injection
    â”œâ”€â”€ config/                   # Frontend environment config
    â”‚   â”œâ”€â”€ index.ts                # Active config export
    â”‚   â”œâ”€â”€ development.ts          # Dev settings
    â”‚   â””â”€â”€ production.ts           # Production settings
    â”œâ”€â”€ types.ts                  # Lightweight TypeScript interfaces
    â””â”€â”€ audio/
        â””â”€â”€ sentence-queue.ts     # Client-side sequential audio playback
```

The backend's route handlers, business logic, database schema, and audio services live in [`adaptive-interview-api`](https://github.com/vdung2k6-myna/adaptive-interview-api). See [backend docs](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md).

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

1. **Dashboard** (`/dashboard`) â€” view all sessions, filter by status, search, click into transcripts, copy interview links
2. **Transcript** (`/interview/[id]/transcript`) â€” review Q/A, view AI evaluation, override with human scores, browse version history, copy link
3. **Compare** (`/compare?a=[id]&b=[id]`) â€” side-by-side candidate comparison
4. **Campaigns** (`/campaigns`) â€” manage hiring campaigns and view aggregated metrics
5. **Positions** (`/positions`) â€” manage positions (create, edit, delete if unused)
6. **Candidates** (`/candidates`) â€” manage candidates (create, edit, delete if unused)
7. **Setup** (`/setup`) â€” create a new interview by selecting a position + candidate

### For Candidates

1. **Interview** (`/interview/[id]`) â€” AI generates the first question immediately, streamed word-by-word
2. **Answer** â€” type a response, AI generates the next context-aware follow-up
3. **Completion** â€” after max turns (default 8), the interview ends and evaluation becomes available

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

- [`docs/API.md`](docs/API.md) â€” Link to backend API reference
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) â€” Frontend architecture and data flow
- [`docs/COMPONENTS.md`](docs/COMPONENTS.md) â€” React component inventory
- [`docs/DATABASE.md`](docs/DATABASE.md) â€” Database is backend-only
- [`docs/EVALUATION.md`](docs/EVALUATION.md) â€” Scoring and calibration
- [`docs/OLLAMA.md`](docs/OLLAMA.md) â€” Ollama integration from frontend perspective
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) â€” Frontend optimization
- [`docs/SECURITY.md`](docs/SECURITY.md) â€” Security considerations
- [`docs/SETUP.md`](docs/SETUP.md) â€” Frontend setup
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) â€” Feature history

Backend docs:

- [Backend Setup](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md)
- [Backend API Reference](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/API.md)
- [Backend Architecture](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md)

---

## License

MIT
