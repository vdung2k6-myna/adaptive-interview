# Design: Resync Documentation After Backend Extraction

## Goal

Split documentation ownership cleanly between the two repositories after the backend extraction.

```
┌─────────────────────────────────────────────┐
│  Frontend repo (ollama-chat-react)          │
│  docs/                                      │
│  ├── README.md              (landing)       │
│  ├── ARCHITECTURE.md        (frontend-only) │
│  ├── COMPONENTS.md          (React)         │
│  ├── PERFORMANCE.md         (UI perf)       │
│  ├── SETUP.md               (frontend dev)  │
│  ├── SECURITY.md            (client + API)  │
│  ├── CHANGELOG.md           (project log)   │
│  ├── API.md                 (stub → backend docs)
│  └── DATABASE.md            (stub → backend docs)
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Backend repo (adaptive-interview-api)        │
│  docs/                                      │
│  ├── API.md                  (full REST ref) │
│  ├── ARCHITECTURE.md         (backend)       │
│  ├── SETUP.md                (backend + DB)  │
│  └── README.md               (landing)       │
└─────────────────────────────────────────────┘
```

## Backend Docs

### `docs/API.md`

Start from the current frontend `docs/API.md`, which already documents most endpoints accurately. Remove any frontend-specific framing ("frontend uses `apiFetch()`") and add missing backend endpoints.

Structure:

1. Base URL & proxy note
2. Authentication
3. Candidates
4. Positions
5. Sessions
6. Messages (streaming behavior)
7. Voice interview (`/api/voice/*`)
8. Audio serving (`/audio/*`)
9. Evaluations (including async jobs)
10. Campaigns
11. MCP analytics
12. Error format

Add sections currently missing from the frontend copy:
- `POST /api/voice/turn`
- `POST /api/voice/stream` (SSE)
- `POST /api/voice/speak-stream` (SSE)
- Full evaluation endpoints: `PATCH`, `DELETE version`, `GET versions/:id`, `GET jobs/:jobId`
- Campaign add/remove position endpoints

### `docs/ARCHITECTURE.md`

Focus on the backend's internal layers:

```
Express Route Handlers (src/routes/*.ts)
         │
         ▼
Business Logic (src/lib/*.ts)
  ├─ prompts.ts
  ├─ ollama.ts
  ├─ evaluation.ts
  ├─ embeddings.ts
  ├─ audio/*.ts
  └─ position-queries.ts
         │
         ▼
Data Access (src/lib/db.ts, src/lib/schema.ts)
         │
         ▼
PostgreSQL + pgvector
```

Include call flows for:
- Text interview streaming (`POST /api/messages`)
- Voice standard turn
- Voice streaming turn (SSE)
- Evaluation async job
- MCP SSE tool call

### `docs/SETUP.md`

Move backend setup details from frontend `docs/SETUP.md`:

1. Prerequisites (Node, PostgreSQL, Ollama)
2. `npm install` + `cp .env.example .env`
3. PostgreSQL setup + pgvector
4. `npx drizzle-kit migrate`
5. `npx tsx src/lib/seed.ts` (seed is in backend)
6. Ollama model pulls
7. Audio services setup (expand from current `README.md` audio section)
8. `npm run dev`
9. Verify with `curl /health`

### `README.md` updates

Make `README.md` a short landing page:

```markdown
# Adaptive Interview API

Standalone Express backend for the Adaptive Interview Engine.

- [Setup Guide](docs/SETUP.md)
- [API Reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Frontend repo](../ollama-chat-react) (sibling repository)
```

Then add a route table and fix the env var table:
- `API_AUTH_TOKEN`: Optional
- `MCP_AUTH_TOKEN`: Optional
- Add `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`, `EMBEDDING_SIMILARITY_THRESHOLD`, `MCP_ENABLED`

## Frontend Docs

### `docs/API.md` → stub

Replace the full API reference with:

```markdown
# API Documentation

The Adaptive Interview Engine API is served by the standalone Express backend in `adaptive-interview-api`.

- Base URL in dev: proxied from `http://localhost:3000/api/*` to `http://localhost:4000/api/*`
- Full reference: [adaptive-interview-api/docs/API.md](../adaptive-interview-api/docs/API.md)

Frontend components use `apiFetch()` from `@/lib/api-client`, which injects `Authorization: Bearer <token>` when `NEXT_PUBLIC_API_TOKEN` is set.
```

### `docs/DATABASE.md` → backend-only

Rewrite to explain:
- Frontend has no database connection
- Schema, migrations, and vector similarity queries live in `adaptive-interview-api`
- Frontend uses `src/lib/types.ts` for lightweight TypeScript interfaces
- Link to backend `docs/ARCHITECTURE.md` and `docs/SETUP.md`

### `docs/ARCHITECTURE.md` updates

- Keep high-level Pattern B diagrams (they're correct)
- Remove deleted backend files from the frontend file tree (`db.ts`, `schema.ts`, `ollama.ts`, `evaluation.ts`, `prompts.ts`, `embeddings.ts`, seed, most of `audio/`)
- Update file tree to only existing files:
  - `src/lib/api-client.ts`
  - `src/lib/config/*`
  - `src/lib/types.ts`
  - `src/lib/use-playback-rate.ts`
  - `src/lib/audio/sentence-queue.ts`
- Remove SSR labels from `candidates`, `positions`, `campaigns`, `setup` pages
- Keep backend architecture section but point to backend docs for details

### `docs/SETUP.md` updates

Remove backend-only steps and fix broken commands:
- Remove `npx drizzle-kit migrate` from frontend (it's backend now)
- Remove `npx tsx src/lib/seed.ts` from frontend (it's backend now)
- Remove DB/Ollama setup from frontend (link to backend `docs/SETUP.md`)
- Keep frontend-only: `npm install`, `NEXT_PUBLIC_API_TOKEN`, `npm run dev`, build/lint
- Keep verification list but make it frontend-oriented
- Remove `src/lib/config/` env-specific tuning claims (those values are now in backend)

### `README.md` updates

Fix the architecture diagram labels:
- Positions/Candidates/Campaigns/Setup: change `(SSR)` to `(Client)`
- Keep backend/services labels correct

### `docs/CHANGELOG.md` audit

Scan the last ~10 entries and fix stale paths:
- Entries mentioning `src/app/api/*` → note deleted / moved to backend
- Entries mentioning `src/lib/audio/wav-utils.ts`, `text-processing.ts`, etc. → moved to backend
- Entries mentioning `src/lib/schema.ts`, `src/lib/db.ts`, `src/lib/evaluation.ts` in monolith → backend now
- Keep historical accuracy; just correct the "What changed" file paths

### `docs/SECURITY.md` updates

- SQL injection section: examples should reference backend Drizzle queries, not frontend (since DB access is gone)
- SSRF section: remove "legacy `src/lib/ollama.ts`" hedging; it's deleted
- Voice data privacy: correct that audio storage is backend-only (already says this, can be tightened)

## Cross-Repo Linking

Use relative sibling-repo paths so links work when repos are cloned side by side:

```markdown
[Backend API docs](../adaptive-interview-api/docs/API.md)
```

For links that need to work on GitHub too, this assumes both repos share a parent directory, which matches the recommended setup in `README.md`.

## Verification

After changes:

1. Run `npm run build` in both repos (catches no doc issues, but confirms code is clean)
2. Search for deleted file paths in docs:
   ```bash
   grep -R "src/lib/db.ts\|src/lib/schema.ts\|src/app/api" docs/
   ```
3. Click through internal markdown links manually or use `markdown-link-check` if available
4. Ensure no doc says frontend performs DB queries or hosts API routes

## Dependencies

No code dependencies. This change touches only Markdown files and `README.md` files in both repositories.
