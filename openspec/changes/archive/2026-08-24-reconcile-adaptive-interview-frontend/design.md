# Design: Reconcile adaptive-interview as Frontend Repo

## Approach

Use a **clean-tree replacement** rather than a gradual merge. The target repo `adaptive-interview` keeps its `.git` history, but the working tree is replaced with the current frontend-only source from `ollama-chat-react`. A new commit on top of the existing history documents the migration.

## Data Flow

```
ollama-chat-react/ (source)
    â”‚
    â”œâ”€â”€ clean working tree
    â”‚   (commit or stash pending changes first)
    â”‚
    â–¼
adaptive-interview/ (target)
    â”‚
    â”œâ”€â”€ git rm -rf .
    â”œâ”€â”€ copy source files (respecting ignore rules)
    â”œâ”€â”€ adapt README/package links
    â”œâ”€â”€ git add + commit
    â””â”€â”€ git push
```

## Files to Copy

### From `ollama-chat-react`

- `src/` (pages, components, frontend lib)
- `public/`
- `scripts/`
- `docs/` (frontend-oriented docs)
- `lib/` (Drizzle config and migrations? â€” verify, frontend repo keeps `drizzle.config.ts` + `migrations/`?)
- `*.config.*` (Next, PostCSS, Tailwind, ESLint, TypeScript)
- `package.json` / `package-lock.json`
- `README.md`
- `CLAUDE.md`
- `LICENSE` / `NOTICE` if present
- `openspec/` (active changes)

### Explicitly Excluded

- `.git/` (target keeps its own)
- `node_modules/`
- `.next/`
- `dist/`
- `.env.local`
- `.env.production`
- `tsconfig.tsbuildinfo`
- `frontend.log`
- `.pid`
- `.claude/` if it contains session-local files

## Cross-Repo Link Updates

### `adaptive-interview/README.md`

Replace:

```markdown
[Adaptive Interview API](../adaptive-interview-api)
[Backend Setup Guide](../adaptive-interview-api/docs/SETUP.md)
[Backend API Reference](../adaptive-interview-api/docs/API.md)
[Backend Architecture](../adaptive-interview-api/docs/ARCHITECTURE.md)
```

With:

```markdown
[Adaptive Interview API](https://github.com/vdung2k6-myna/adaptive-interview-api)
[Backend Setup Guide](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/SETUP.md)
[Backend API Reference](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/API.md)
[Backend Architecture](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md)
```

### `adaptive-interview-api/README.md`

Update the relative link back to the frontend:

```markdown
Standalone backend API for the [Adaptive Interview Engine](https://github.com/vdung2k6-myna/adaptive-interview).
```

## `package.json` Name

Change `"name": "ollama-chat-react"` â†’ `"name": "adaptive-interview"` to match the published repo.

## Verification Steps

1. `cd adaptive-interview && npm install`
2. `npm run build`
3. `npm run lint`
4. Search for `../adaptive-interview-api` in markdown files
5. Search for `src/app/api/` in tree
6. Search for `DATABASE_URL` in committed files (should only be in docs, not `.env`)

## Rollback

If the replacement is bad, the old tree can be restored by checking out the previous commit (`ebc605c` or the migration commit's parent) and reverting the migration commit.
