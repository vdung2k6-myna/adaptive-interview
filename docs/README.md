# Developer Documentation

Welcome to the **Adaptive Interview Engine** developer docs. This is a comprehensive guide for developers working on or extending this AI-powered technical interview platform.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System design, data flow, and component relationships |
| [API](API.md) | REST API endpoints, request/response formats |
| [Database](DATABASE.md) | PostgreSQL schema, migrations, and queries |
| [Ollama Integration](OLLAMA.md) | AI model integration, prompts, and streaming |
| [Evaluation](EVALUATION.md) | Post-interview AI scoring system |
| [Components](COMPONENTS.md) | Key React components and their responsibilities |
| [Setup Guide](SETUP.md) | Development environment setup |
| [Performance](PERFORMANCE.md) | Performance considerations and optimizations |
| [Security](SECURITY.md) | Security best practices and considerations |
| [OpenSpec](OPENSPEC.md) | How we use OpenSpec for change management |
| [Changelog](CHANGELOG.md) | Recent changes and design decisions |

## Project Overview

The Adaptive Interview Engine is a Next.js application that conducts AI-powered technical interviews using local or remote Ollama models. It generates personalized questions based on candidate CVs and position requirements, then evaluates responses post-interview.

### Key Capabilities

- **Adaptive questioning** — Each question is contextually aware of the candidate's background and the position's requirements
- **Real-time streaming** — Interviewer responses stream token-by-token for a natural conversation feel
- **Vector search** — Semantic embeddings track which position requirements have been covered
- **AI evaluation** — Post-interview scoring across 4 dimensions with confidence scores
- **Rich Markdown rendering** — Syntax-highlighted code blocks, bold text, lists in interviewer messages

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL 15+ |
| ORM | Drizzle ORM |
| AI Backend | Ollama (local or remote) |
| Embedding | mxbai-embed-large via Ollama |
| Fonts | Geist Sans + Mono |

## Getting Started

See [Setup Guide](SETUP.md) for full instructions.

```bash
# Quick start
npm install
# Configure .env.local (see SETUP.md)
npx drizzle-kit migrate
npx tsx src/lib/seed.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Dashboard│  │ Interview│  │ Transcript│  │ Compare  │   │
│  │  (SSR)   │  │ (Client) │  │ (Client) │  │ (Client) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                          │
                    ┌─────┴─────┐
                    │ Next.js   │
                    │ API Routes│
                    └─────┬─────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
   │PostgreSQL│      │ Ollama  │      │Embeddings│
   │(Drizzle) │      │(Local)  │      │(Vector)  │
   └─────────┘      └─────────┘      └─────────┘
```

## Contributing

1. Check [OpenSpec](OPENSPEC.md) for how we manage changes
2. Read the relevant docs before modifying code
3. Run `npm run build` and `npm run lint` before committing
4. Update docs if you change architecture or APIs

## License

MIT
