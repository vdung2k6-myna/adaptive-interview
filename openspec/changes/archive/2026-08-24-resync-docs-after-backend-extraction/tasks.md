# Tasks: Resync Documentation After Backend Extraction

## Phase 1: Backend Documentation

- [x] Create `adaptive-interview-api/docs/API.md` from frontend `docs/API.md`
  - [x] Copy current frontend API reference content
  - [x] Add missing endpoints: `POST /api/voice/turn`, `POST /api/voice/stream`, `POST /api/voice/speak-stream`
  - [x] Add full evaluation endpoints: `PATCH`, `DELETE version`, `GET versions/:id`, `GET jobs/:jobId`
  - [x] Add campaign position add/remove endpoints
  - [x] Remove frontend-specific phrasing (`apiFetch()`, Next.js proxy details can stay as a note)
- [x] Create `adaptive-interview-api/docs/ARCHITECTURE.md`
  - [x] Backend layer diagram (routes → lib → db → PostgreSQL)
  - [x] Text interview streaming flow
  - [x] Voice standard turn flow
  - [x] Voice streaming SSE turn flow
  - [x] Evaluation async job flow
  - [x] MCP SSE tool call flow
- [x] Create `adaptive-interview-api/docs/SETUP.md`
  - [x] Prerequisites
  - [x] `npm install` + `.env.example` copy
  - [x] PostgreSQL + pgvector setup
  - [x] `npx drizzle-kit migrate`
  - [x] `npx tsx src/lib/seed.ts`
  - [x] Ollama model pulls
  - [x] Audio services setup
  - [x] `npm run dev` and `/health` verification
- [x] Update `adaptive-interview-api/README.md`
  - [x] Convert to landing page linking to `docs/`
  - [x] Fix auth env var required/optional flags (`API_AUTH_TOKEN`, `MCP_AUTH_TOKEN` are optional)
  - [x] Add missing env vars: `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`, `EMBEDDING_SIMILARITY_THRESHOLD`, `MCP_ENABLED`
  - [x] Keep short route table and curl examples or move them into `docs/API.md`
- [x] Fix `adaptive-interview-api/audio-gateway/README.md`
  - [x] Change diagram label from "Next.js App (:3000)" to "Express Backend (:4000)"

## Phase 2: Frontend Documentation Cleanup

- [x] Rewrite `ollama-chat-react/docs/API.md` as a stub linking to backend docs
- [x] Rewrite `ollama-chat-react/docs/DATABASE.md` to reflect backend-only database access
- [x] Update `ollama-chat-react/docs/ARCHITECTURE.md`
  - [x] Remove deleted backend files from frontend file tree
  - [x] Remove SSR labels from list pages
  - [x] Point detailed backend architecture to backend `docs/ARCHITECTURE.md`
- [x] Fix `ollama-chat-react/docs/SETUP.md`
  - [x] Remove broken `npx drizzle-kit migrate` frontend command
  - [x] Remove broken `npx tsx src/lib/seed.ts` frontend command
  - [x] Move DB/Ollama setup to backend doc links
  - [x] Correct `src/lib/config/` description
- [x] Update `ollama-chat-react/README.md`
  - [x] Fix architecture diagram labels (SSR → Client for list pages)
- [x] Audit `ollama-chat-react/docs/CHANGELOG.md`
  - [x] Add path migration note explaining moved backend files
  - [x] Mark moved files as "moved to backend" where appropriate
- [x] Tighten `ollama-chat-react/docs/SECURITY.md`
  - [x] SQL injection examples reference backend
  - [x] Remove hedging about legacy `src/lib/ollama.ts`

## Phase 3: Validation

- [x] Run `npm run build` in `adaptive-interview-api`
- [x] Run `npm run build` in `ollama-chat-react`
- [x] Search frontend docs for references to deleted files (`src/lib/db.ts`, `src/lib/schema.ts`, `src/app/api/*`, etc.)
- [x] Verify internal markdown links between repos use sibling-relative paths
- [x] Read through updated docs for consistency
