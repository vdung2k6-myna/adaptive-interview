# Proposal: Resync Documentation After Backend Extraction

## Problem

The backend extraction (`complete-backend-extraction` and `clean-monolith-backend-code`) moved all API routes, database access, business logic, and audio services from the Next.js monolith into the standalone `adaptive-interview-api` repository. The documentation in both repositories no longer matches the actual architecture.

Specifically:

1. **Frontend docs describe backend internals** — `docs/API.md`, `docs/DATABASE.md`, and `docs/ARCHITECTURE.md` still detail backend routes, schema, and file organization as if they live in the monolith.
2. **Backend has no dedicated docs** — `adaptive-interview-api/README.md` carries API reference, setup, and architecture in one file, and several endpoints are undocumented.
3. **Setup instructions are broken** — `docs/SETUP.md` still tells frontend users to run `npx drizzle-kit migrate` and `npx tsx src/lib/seed.ts`, both of which reference deleted files.
4. **File paths in changelog are stale** — `docs/CHANGELOG.md` points to monolith paths for files that have moved to or now live only in the backend.
5. **Architecture diagrams are misleading** — `README.md` and `ARCHITECTURE.md` still label list pages as SSR and include deleted backend files in the frontend file tree.

Outdated docs are a bug: they mislead new developers and slow down maintenance.

## Solution

Restructure the documentation so that each repository owns the docs for the code it actually contains:

- **Backend repo** becomes the source of truth for API reference, backend architecture, and backend setup.
- **Frontend repo** keeps only frontend-specific docs (components, UI data flow, frontend setup, changelog).

This means creating proper `docs/` directory in the backend, moving the bulk of API/DB/architecture content there, and reducing the frontend equivalents to stubs or frontend-only concerns.

## Scope

### In Scope

**Backend (`adaptive-interview-api`)**
- Create `docs/API.md` — full REST API reference (moved and expanded from frontend `docs/API.md`)
- Create `docs/ARCHITECTURE.md` — backend internal architecture (routes → lib → db, streaming, voice pipeline, MCP)
- Create `docs/SETUP.md` — backend-only setup (env, DB, Ollama, audio services)
- Update `README.md` — make it a short landing page linking to `docs/`
- Fix env var "Required" flags in `README.md` (`API_AUTH_TOKEN`, `MCP_AUTH_TOKEN` are optional)
- Add missing env vars to `README.md` (`OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`, etc.)
- Fix `audio-gateway/README.md` diagram label ("Express Backend" instead of "Next.js App")

**Frontend (`ollama-chat-react`)**
- Reduce `docs/API.md` to a stub that links to backend `docs/API.md`
- Rewrite `docs/DATABASE.md` — DB is backend-only; frontend has no direct access
- Update `docs/ARCHITECTURE.md` — remove deleted backend files from frontend file tree; remove SSR labels from list pages
- Fix `docs/SETUP.md` — remove broken migration/seed commands; move backend setup to backend repo
- Fix `README.md` architecture diagram labels (list pages are Client Components)
- Audit last ~10 `docs/CHANGELOG.md` entries for stale file paths
- Tighten `docs/SECURITY.md` DB/SSRF language now that DB access is backend-only

### Out of Scope
- Changing application code (this is docs-only)
- Renaming repositories
- Deployment / CI docs (can be a follow-up change)
- Updating backend service READMEs beyond the audio-gateway diagram fix

## Risks

| Risk | Mitigation |
|------|-----------|
| Moving docs creates broken links | Add redirects/stubs in frontend; verify all internal links work |
| Frontend `docs/API.md` becomes too thin | Keep a short "How frontend calls the API" section plus link to backend |
| Backend docs duplicate frontend changelog | Keep changelog in frontend only; backend can reference it |
| Two-repo change is harder to review | Split into two phases: backend docs first, then frontend slim-down |

## Success Criteria

- [ ] Backend has complete `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SETUP.md`
- [ ] Backend `README.md` is a landing page and all env vars are correctly documented
- [ ] Frontend `docs/API.md` and `docs/DATABASE.md` no longer claim backend code lives in the monolith
- [ ] Frontend `docs/SETUP.md` has no broken commands or backend-only steps
- [ ] `docs/ARCHITECTURE.md` and `README.md` diagrams match the Client-Component reality
- [ ] `docs/CHANGELOG.md` entries reference existing files only
- [ ] `npm run build` passes in both repos (no dead imports from docs, though docs don't affect build)
- [ ] No stale internal markdown links remain
