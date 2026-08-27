# Developer Documentation

Welcome to the **Adaptive Interview Engine** frontend developer docs. This guide covers the Next.js presentation layer. Server-side documentation (database, Ollama, evaluation, performance, MCP, audio services) lives in the [`adaptive-interview-api`](https://github.com/vdung2k6-myna/adaptive-interview-api) repository.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | Frontend system design, data flow, and PWA architecture |
| [API](API.md) | REST API endpoints consumed by the frontend (backend surface) |
| [Components](COMPONENTS.md) | Key React components and their responsibilities |
| [Setup Guide](SETUP.md) | Development environment setup |
| [Security](SECURITY.md) | Frontend security best practices |
| [OpenSpec](OPENSPEC.md) | How we use OpenSpec for change management |
| [PWA Install Guide](PWA-INSTALL.md) | How to install the app on Android and iOS |
| [Changelog](CHANGELOG.md) | Recent changes and design decisions |

## Backend Documentation

Backend concerns have been moved to the API repository:

| Document | Description |
|----------|-------------|
| [Backend Architecture](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md) | Express API design, voice pipeline, MCP, file organization |
| [Database](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/DATABASE.md) | PostgreSQL schema, migrations, queries, vector search |
| [Ollama Integration](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/OLLAMA.md) | AI model integration, prompts, streaming |
| [Evaluation](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/EVALUATION.md) | Post-interview AI scoring system |
| [Performance](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/PERFORMANCE.md) | Backend performance tuning and frontend rendering notes |
| [Backend Security](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SECURITY.md) | Server-side threat model, MCP security, audio storage |

## Project Overview

The **Adaptive Interview Engine** is a split-repository application:

- **This repository** — Next.js frontend (presentation layer)
- **`adaptive-interview-api`** — Express backend (API, database, AI, audio)

The frontend conducts AI-powered technical interviews by calling the backend over HTTP. It generates personalized questions, streams interviewer responses, and renders evaluation results.

### Key Capabilities

- **Adaptive questioning** — Each question is contextually aware of the candidate's background and the position's requirements
- **Real-time streaming** — Interviewer responses stream token-by-token for a natural conversation feel
- **AI evaluation** — Post-interview scoring across multiple dimensions with confidence scores
- **Rich Markdown rendering** — Syntax-highlighted code blocks, bold text, lists in interviewer messages
- **Voice interviews** — Record answers via microphone, listen to synthesized responses (backend audio pipeline)
- **Interview language** — Each session can run in `english` or `vietnamese`, which the backend uses for prompts and TTS voice selection
- **PWA install support** — Install on Android and iOS home screens for a standalone experience

### Tech Stack

| Layer | Technology | Repository |
|-------|------------|------------|
| Frontend Framework | Next.js 16 (App Router) | This repo |
| Language | TypeScript 5 (strict) | Both |
| Styling | Tailwind CSS 4 | This repo |
| UI Components | React Client Components | This repo |
| Database | PostgreSQL 15+ | Backend |
| ORM | Drizzle ORM | Backend |
| Backend API | Express.js | `adaptive-interview-api` |
| AI Backend | Ollama (local or remote) | Backend |
| Embedding | mxbai-embed-large via Ollama | Backend |
| Fonts | Geist Sans + Mono | This repo |
| PWA | Web App Manifest + Service Worker | This repo |

## Getting Started

See [Setup Guide](SETUP.md) for full instructions.

```bash
# 1. Clone frontend
git clone https://github.com/vdung2k6-myna/adaptive-interview.git adaptive-interview
cd adaptive-interview
npm install

# 2. Clone backend (separate repo)
git clone https://github.com/vdung2k6-myna/adaptive-interview-api.git adaptive-interview-api
cd adaptive-interview-api
npm install

# 3. Configure environment (see SETUP.md)
#    - Backend: .env (DATABASE_URL, OLLAMA_BASE_URL, etc.)
#    - Frontend: .env.local (NEXT_PUBLIC_API_TOKEN if auth enabled)

# 4. Start backend (port 4000)
cd adaptive-interview-api
npm run dev

# 5. Start frontend (port 3000) — in another terminal
cd ../adaptive-interview
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Dashboard│  │ Interview│  │ Transcript│  │ Compare  │   │
│  │ (Client) │  │ (Client) │  │ (Client) │  │ (Client) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Positions│  │ Candidates│  │ Campaigns│  │  Setup   │   │
│  │ (Client) │  │ (Client) │  │ (Client) │  │ (Client) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                          │
              fetch() / apiFetch()
                          │
                    ┌─────┴─────┐
                    │  Next.js  │
                    │  Rewrites │
                    │ (dev only)│
                    └─────┬─────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                     BACKEND (Express)                         │
│              /api/*  →  CRUD, Streaming, Voice, MCP        │
│              /audio/* →  Audio file serving                   │
│                     (port 4000)                               │
└─────────────────────────────────────────────┬───────────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                     ┌────┴────┐        ┌────┴────┐        ┌────┴────┐
                     │PostgreSQL│        │ Ollama  │        │Embeddings│
                     │(Drizzle) │        │(Local)  │        │(Vector)  │
                     └─────────┘        └─────────┘        └─────────┘
```

The frontend has **no database connection**. All reads and writes go through the backend Express API, proxied via Next.js rewrites in development and a reverse proxy in production.

## Contributing

1. Check [OpenSpec](OPENSPEC.md) for how we manage changes
2. Read the relevant docs before modifying code
3. Run `npm run build` and `npm run lint` before committing
4. Update docs if you change architecture, APIs, components, or PWA behavior

## License

MIT
