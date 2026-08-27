# Tasks: Consolidate Backend-Specific Docs in Backend Repo

## Phase 1: Create Backend Docs

- [x] Create `adaptive-interview-api/docs/DATABASE.md`
  - [x] Base on frontend `docs/DATABASE.md`
  - [x] Rewrite framing for backend repository
  - [x] Expand schema table with columns from `src/lib/schema.ts`
  - [x] Add migration file locations and `drizzle-kit` workflow
  - [x] Keep vector search and backup sections
- [x] Create `adaptive-interview-api/docs/EVALUATION.md`
  - [x] Move frontend `docs/EVALUATION.md` content
  - [x] Update internal links to local backend paths where appropriate
  - [x] Verify model list matches backend
- [x] Create `adaptive-interview-api/docs/OLLAMA.md`
  - [x] Move frontend `docs/OLLAMA.md` content
  - [x] Remove "frontend has no Ollama client" framing
  - [x] Verify function signatures and error table
- [x] Create `adaptive-interview-api/docs/PERFORMANCE.md`
  - [x] Move frontend `docs/PERFORMANCE.md` content
  - [x] Note that UI perf sections apply to frontend repo
- [x] Update `adaptive-interview-api/README.md`
  - [x] Add links to new docs in Quick Links section
  - [x] Ensure route overview and env vars stay accurate
- [x] Update `adaptive-interview-api/.env.example`
  - [x] Add `MCP_ENABLED`
  - [x] Add `EMBEDDING_SIMILARITY_THRESHOLD`
  - [x] Add per-language voice vars: `KOKORO_VOICE_ENGLISH`, `KOKORO_VOICE_VIETNAMESE`, `PIPER_VOICE_ENGLISH`, `PIPER_VOICE_VIETNAMESE`

## Phase 2: Clean Up Frontend Docs

- [x] Rewrite `docs/ARCHITECTURE.md`
  - [x] Keep frontend-only overview
  - [x] Remove detailed backend internals
  - [x] Fix any `(SSR)` labels to `(Client)`
  - [x] Link to backend `docs/ARCHITECTURE.md`
- [x] Rewrite `docs/SECURITY.md`
  - [x] Keep HTML injection, API client token, browser-side voice privacy
  - [x] Remove or move backend-specific sections to backend doc
  - [x] Link to backend `docs/SECURITY.md`
- [x] Update `docs/README.md`
  - [x] Remove moved docs from quick-links table
  - [x] Add "Backend Documentation" cross-links section
  - [x] Fix architecture diagram `(SSR)` labels to `(Client)`
  - [x] Update feature list to include iOS PWA and interview language
- [x] Update root `README.md`
  - [x] Update documentation list
  - [x] Add iOS PWA and interview-language features
  - [x] Fix any stale backend doc links
- [x] Delete moved docs from frontend
  - [x] `docs/DATABASE.md`
  - [x] `docs/EVALUATION.md`
  - [x] `docs/OLLAMA.md`
  - [x] `docs/PERFORMANCE.md`

## Phase 3: Update CLAUDE.md

- [x] Update documentation-update table
  - [x] Point DB changes to backend `docs/DATABASE.md`
  - [x] Point Ollama changes to backend `docs/OLLAMA.md`
  - [x] Point evaluation changes to backend `docs/EVALUATION.md`
  - [x] Point performance changes to backend `docs/PERFORMANCE.md`
  - [x] Keep component/security/setup/changelog rows pointing to frontend docs

## Phase 4: Validation

- [x] Run `npm run build` in `adaptive-interview-api` — passed (`tsc` ok)
- [ ] Run `npm run build` in `adaptive-interview` — blocked: dev server on port 3000 (PID 12520) holds `.next/standalone`
- [x] Search frontend markdown for deleted doc filenames and fix or remove references
- [x] Search backend markdown for stale references to frontend-only paths — none found
- [x] Read through updated README and docs landing pages for consistency

### Additional checks

- [x] `npx tsc --noEmit` in frontend — passed
- [x] `npm run lint` in backend — passed (3 pre-existing warnings)
- [x] `npm run lint` in frontend — pre-existing errors/warnings only (2 errors in `scripts/test-coverage.js`, 6 warnings elsewhere)
- [x] Frontend `.next/standalone` lock confirmed via PowerShell; user needs to stop the dev server to run a clean build
