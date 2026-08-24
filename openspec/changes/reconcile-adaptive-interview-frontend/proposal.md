# Proposal: Reconcile adaptive-interview as Frontend Repo

## Problem

The published repository `https://github.com/vdung2k6-myna/adaptive-interview` currently contains the **pre-extraction Next.js monolith** — full-stack code with `src/app/api/*` routes, backend `src/lib/*` logic, database schema, and Ollama integration. However, active development has moved to a split architecture:

- `ollama-chat-react` (this repo) → Next.js **frontend** only
- `adaptive-interview-api` → Standalone Express **backend**

This means the published `adaptive-interview` repo is **misleading**: its README and code describe a full-stack monolith, but the canonical backend is now elsewhere. It also cannot consume the standalone backend without modification.

## Solution

Replace the contents of `vdung2k6-myna/adaptive-interview` with the frontend-only codebase from `ollama-chat-react`, and update cross-repo references so the published repo correctly represents the frontend in the split architecture.

## Scope

### In Scope

- Replace `adaptive-interview` working tree with frontend-only source from `ollama-chat-react`
- Preserve useful git history notes from the old monolith (the existing commits already mention backend/frontend separation)
- Update README cross-links to use absolute GitHub URLs instead of `../adaptive-interview-api` sibling paths
- Update `package.json` `name` from `ollama-chat-react` to `adaptive-interview` (optional but consistent)
- Update `adaptive-interview-api/README.md` to link back to the correct frontend repo
- Verify the replaced repo builds and key files are present
- Document the migration in both repos

### Out of Scope

- Merging the two repos into a monorepo
- Changing backend code or API contracts
- Finishing the unrelated `complete-backend-extraction` OpenSpec change (it is independent of this repo swap)
- Preserving the old monolith code after replacement (it remains in git history)

## Risks

| Risk | Mitigation |
|------|-----------|
| Force-pushing a new root confuses GitHub users/forks | Add a clear migration note in README and CHANGELOG |
| Relative `../adaptive-interview-api` links break on GitHub | Replace with absolute `https://github.com/vdung2k6-myna/adaptive-interview-api/...` URLs |
| `.env.local` or local secrets copied accidentally | Explicitly exclude `.env.local`, `.env.production`, logs, `.next/`, `node_modules/` |
| Active OpenSpec state in `ollama-chat-react` not captured | Copy `openspec/` directory; finish or migrate `complete-backend-extraction` separately |
| Generated files or stale build artifacts copied | Exclude `.next/`, `dist/`, `tsconfig.tsbuildinfo`, `frontend.log`, `.pid` |
| Package name collision or confusion | Rename `package.json` `name` to `adaptive-interview` |

## Success Criteria

- [ ] `adaptive-interview` repo contains only frontend code after reconciliation
- [ ] `npm run build` passes in `adaptive-interview`
- [ ] `npm run lint` passes in `adaptive-interview`
- [ ] README links point to the backend repo via absolute GitHub URLs
- [ ] `adaptive-interview-api/README.md` links back to `adaptive-interview` correctly
- [ ] No backend API routes, `src/lib/ollama.ts`, or DB secrets remain in the published frontend repo
- [ ] CHANGELOG documents the migration
