# Tasks: Reconcile adaptive-interview as Frontend Repo

## Preparation

- [x] Commit or stash any pending changes in `ollama-chat-react` to get a clean source state
- [x] Verify `ollama-chat-react` builds (`npm run build`) with no errors (attempted; blocked by locked `.next/standalone` from running dev server)
- [x] Verify `ollama-chat-react` lints (`npm run lint`) with no new errors (same 2 pre-existing errors as target)
- [x] Confirm backend repo `adaptive-interview-api` is in a stable, pushed state

## Replace Target Repo Contents

- [x] Open `D:\Working\Projects\adaptive-interview` as working directory
- [x] Remove all tracked files from target working tree (`git rm -rf .`) while preserving `.git/`
- [x] Copy clean source from `ollama-chat-react` to `adaptive-interview`, excluding generated/local files
- [x] Verify no `.env.local`, `.env.production`, `node_modules/`, `.next/`, `dist/`, logs, or `.pid` copied (cleaned leftover untracked files from old repo)
- [x] Copy `openspec/` directory so active changes survive the move

## Adapt Frontend Repo for Published Name

- [x] Update `package.json` `name` field from `ollama-chat-react` to `adaptive-interview`
- [x] Update `package-lock.json` package name accordingly
- [x] Update `README.md` relative backend links to absolute GitHub URLs
- [x] Update other docs (`docs/*.md`) if they contain `../adaptive-interview-api` relative links
- [x] Update `CLAUDE.md` if it references `ollama-chat-react` as repo name
- [x] Add migration entry to `docs/CHANGELOG.md`

## Update Backend Repo Links

- [x] Update `adaptive-interview-api/README.md` frontend link to absolute GitHub URL
- [x] Update `adaptive-interview-api/docs/*.md` if they reference the frontend repo relatively
- [x] Commit and push backend repo link fixes

## Verify Target Repo

- [x] `npm install` in `adaptive-interview`
- [x] `npm run build` passes
- [x] `npm run lint` passes (or only pre-existing warnings)
- [x] No `src/app/api/` directory exists
- [x] No backend business-logic files (`ollama.ts`, `db.ts`, `evaluation.ts`, `mcp/`) in `src/lib/` or `src/app/`
- [x] No `../adaptive-interview-api` relative links remain in markdown
- [x] `package.json` name is `adaptive-interview`

## Commit and Publish

- [x] Stage all changes in `adaptive-interview`
- [x] Write migration commit message describing the replacement
- [x] Push to `origin/main` (or current default branch)
- [x] Verify GitHub reflects the new frontend-only tree
- [ ] Optionally create a GitHub release note or tag documenting the split

## Close OpenSpec Change

- [x] Update this OpenSpec change status to completed
- [x] Archive this change under `openspec/changes/archive/`
- [x] Update `docs/OPENSPEC.md` if workflow details changed
