# Proposal: Consolidate Backend-Specific Docs in Backend Repo

## Problem

The backend extraction (`complete-backend-extraction`, `clean-monolith-backend-code`, `consolidate-audio-services-in-backend`) moved all API routes, database access, business logic, audio services, and Ollama integration from the Next.js frontend into the standalone `adaptive-interview-api` repository. However, the frontend documentation still owns several documents that describe backend-only concerns:

- `docs/DATABASE.md` — describes PostgreSQL schema, Drizzle ORM, migrations, vector search, all backend-only.
- `docs/EVALUATION.md` — describes the AI evaluation pipeline, async jobs, scoring prompts, all backend-only.
- `docs/OLLAMA.md` — describes the Ollama client, streaming protocol, prompt construction, all backend-only.
- `docs/PERFORMANCE.md` — mixes frontend UI optimizations with backend bottlenecks (embedding on critical path, DB N+1 queries).
- `docs/ARCHITECTURE.md` — still contains detailed backend internals.
- `docs/SECURITY.md` — mixes frontend HTML-injection concerns with backend DB/SSRF/MCP concerns.
- `docs/README.md` — quick-links table still lists backend docs as if they live in the frontend.

This violates the single-responsibility split established by the backend extraction. New developers looking for backend docs land in the frontend repo, and the frontend doc set is larger than necessary.

## Solution

Move backend-specific documentation ownership fully to `adaptive-interview-api`. The frontend keeps only docs for presentation, components, setup, PWA, changelog, and OpenSpec workflow.

Specifically:

- Create the missing backend docs (`DATABASE.md`, `EVALUATION.md`, `OLLAMA.md`, `PERFORMANCE.md`) in `adaptive-interview-api/docs/`.
- Move the relevant backend content from the frontend versions, merge with any additional backend context, and make each backend doc the authoritative source.
- Rewrite frontend `docs/ARCHITECTURE.md` to be frontend-only.
- Rewrite frontend `docs/SECURITY.md` to be frontend-only.
- Delete the moved frontend docs (`DATABASE.md`, `EVALUATION.md`, `OLLAMA.md`, `PERFORMANCE.md`).
- Update frontend `docs/README.md` quick-links to list only remaining frontend docs.
- Update both `README.md` files to reference the new locations.
- Fix stale labels in diagrams (SSR → Client).
- Update `CLAUDE.md` doc-update table so future changes know where docs live.
- Patch backend `.env.example` to include env vars that are documented but missing.

## Scope

### In Scope

**Backend (`adaptive-interview-api`)**
- Create `docs/DATABASE.md` (authoritative DB documentation)
- Create `docs/EVALUATION.md` (authoritative evaluation documentation)
- Create `docs/OLLAMA.md` (authoritative Ollama documentation)
- Create `docs/PERFORMANCE.md` (authoritative performance documentation)
- Update `README.md` to link to new docs
- Update `.env.example` with missing vars from `docs/SETUP.md`
- Ensure backend `docs/ARCHITECTURE.md` covers everything the frontend version covered

**Frontend (`adaptive-interview`)**
- Delete `docs/DATABASE.md`
- Delete `docs/EVALUATION.md`
- Delete `docs/OLLAMA.md`
- Delete `docs/PERFORMANCE.md`
- Rewrite `docs/ARCHITECTURE.md` as frontend-only
- Rewrite `docs/SECURITY.md` as frontend-only
- Update `docs/README.md` quick-links
- Update root `README.md` docs list and feature list
- Fix `(SSR)` labels to `(Client)` where they remain
- Update `CLAUDE.md` documentation-update table

### Out of Scope

- Changing application code
- Renaming repositories
- Rewriting backend docs that already exist (`API.md`, `ARCHITECTURE.md`, `SETUP.md`)
- Deployment / CI docs
- OpenSpec workflow changes beyond the table update

## Risks

| Risk | Mitigation |
|------|-----------|
| Lose content during move | Read both copies side by side; merge before deleting; verify all code blocks, diagrams, and notes survive |
| Broken internal links | Update all cross-references; search for `docs/DATABASE.md` etc. after changes |
| Frontend `docs/README.md` becomes too sparse | Keep all remaining frontend docs listed; only remove moved ones |
| Future contributors still edit frontend copies | Update `CLAUDE.md` table to point to backend paths |

## Success Criteria

- [x] Backend has complete `docs/DATABASE.md`, `docs/EVALUATION.md`, `docs/OLLAMA.md`, `docs/PERFORMANCE.md`
- [x] Frontend no longer contains those four docs
- [x] Frontend `docs/ARCHITECTURE.md` and `docs/SECURITY.md` only discuss frontend concerns
- [x] Frontend `docs/README.md` quick-links do not list moved docs
- [x] Root `README.md` files in both repos link to the correct doc locations
- [x] No stale internal markdown links remain
- [x] `CLAUDE.md` documentation-update table reflects backend ownership
- [ ] `npm run build` passes in both repos (docs don't affect build, but confirms repo health) — backend passed; frontend blocked by running dev server on port 3000
