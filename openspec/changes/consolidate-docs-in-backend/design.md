# Design: Consolidate Backend-Specific Docs in Backend Repo

## Goal

Make each repository the single source of truth for the documentation of the code it actually contains.

```
┌─────────────────────────────────────────────┐
│  Frontend repo (adaptive-interview)         │
│  docs/                                      │
│  ├── README.md              (landing)         │
│  ├── ARCHITECTURE.md        (frontend-only) │
│  ├── COMPONENTS.md          (React)         │
│  ├── SECURITY.md            (client side)   │
│  ├── SETUP.md               (frontend dev)  │
│  ├── PWA-INSTALL.md         (install guide)  │
│  ├── CHANGELOG.md           (project log)   │
│  ├── API.md                 (stub → backend)│
│  └── OPENSPEC.md            (workflow)      │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Backend repo (adaptive-interview-api)        │
│  docs/                                      │
│  ├── API.md                  (full REST ref)│
│  ├── ARCHITECTURE.md         (backend)      │
│  ├── DATABASE.md             (schema/migrations)
│  ├── EVALUATION.md           (AI scoring)   │
│  ├── OLLAMA.md               (AI models)    │
│  ├── PERFORMANCE.md          (backend + UI) │
│  ├── SETUP.md                (backend + DB) │
│  └── README.md               (landing)      │
└─────────────────────────────────────────────┘
```

## Merge Strategy

The frontend versions are the most complete current source for `DATABASE.md`, `EVALUATION.md`, `OLLAMA.md`, and `PERFORMANCE.md`. We will use them as the base, then expand/correct for the backend repo context.

### `docs/DATABASE.md` (new in backend)

Base: frontend `docs/DATABASE.md`.

Changes:
- Replace "from the frontend's point of view" framing with "from the backend's point of view".
- Expand the schema table with actual column definitions from `src/lib/schema.ts`.
- Add migration history and file locations.
- Keep vector-search explanation.
- Keep backup/restore guidance.

### `docs/EVALUATION.md` (new in backend)

Base: frontend `docs/EVALUATION.md`.

Changes:
- Minimal rewrite: the doc already correctly references `src/lib/evaluation.ts` in the backend.
- Change cross-repo links from GitHub URLs to local repo paths where it makes sense.
- Ensure evaluation model list matches current backend options.

### `docs/OLLAMA.md` (new in backend)

Base: frontend `docs/OLLAMA.md`.

Changes:
- Remove the sentence "The frontend repository has no Ollama client" — now irrelevant in backend repo.
- Keep the function signatures, streaming protocol, prompt construction, error handling.
- Update file paths from `src/lib/ollama.ts` (already correct in base).

### `docs/PERFORMANCE.md` (new in backend)

Base: frontend `docs/PERFORMANCE.md`.

Changes:
- Keep the full content; it is already written from a system perspective and covers both frontend UI perf and backend bottlenecks.
- Add a note that frontend UI sections also apply to `adaptive-interview`.

### `docs/ARCHITECTURE.md` (frontend rewrite)

Current frontend version mixes frontend and backend layers. New version will:
- Keep the separated-architecture overview diagram.
- Remove detailed backend business-logic and data-access sections.
- Keep frontend file organization.
- Keep data flow from user action → `apiFetch()` → backend → React state.
- Keep PWA/service worker section (frontend-only).
- Point to backend `docs/ARCHITECTURE.md` for backend internals.
- Fix any remaining `(SSR)` labels to `(Client)`.

### `docs/SECURITY.md` (frontend rewrite)

Current version covers HTML injection, SQL injection, prompt injection, SSRF, API auth, voice privacy, MCP. New frontend version will keep:
- HTML injection (DOMPurify, MarkdownRenderer)
- API client token handling (`NEXT_PUBLIC_API_TOKEN`)
- Voice data privacy from browser perspective (no raw audio stored in browser)
- Prompt injection (high-level, frontend cannot prevent)
- General security checklist items relevant to frontend deployment (HTTPS, CSP, etc.)

Backend-specific sections move or remain in backend `docs/SECURITY.md`:
- SQL injection (Drizzle parameterization)
- SSRF (backend fetch restrictions)
- API auth middleware
- MCP server security
- Audio file storage path traversal

### `docs/README.md` (frontend update)

Remove quick links for `DATABASE.md`, `EVALUATION.md`, `OLLAMA.md`, `PERFORMANCE.md`.
Keep: Architecture, API (stub), Components, Security, Setup, PWA Install, Evaluation (link to backend), Ollama (link to backend), Database (link to backend), Performance (link to backend), OpenSpec, Changelog.

Wait — per proposal, quick-links should not list moved docs. But it is useful to link to them under backend docs. We will add a separate "Backend Documentation" table/section for cross-repo links.

### Root `README.md` updates

**Frontend:**
- Update documentation list to reflect moved docs.
- Add iOS PWA and interview-language features.

**Backend:**
- Add links to new docs (`DATABASE.md`, `EVALUATION.md`, `OLLAMA.md`, `PERFORMANCE.md`).

### `CLAUDE.md` update

Update the documentation-update table so that future changes know where each type of doc lives:

| Change Type | Documents to Update |
|-------------|---------------------|
| New API endpoint | `adaptive-interview-api/docs/API.md`, both `ARCHITECTURE.md` |
| New database table/column | `adaptive-interview-api/docs/DATABASE.md`, both `ARCHITECTURE.md` |
| New component | `docs/COMPONENTS.md`, `docs/ARCHITECTURE.md` |
| Ollama/prompt changes | `adaptive-interview-api/docs/OLLAMA.md`, both `ARCHITECTURE.md` |
| Evaluation changes | `adaptive-interview-api/docs/EVALUATION.md`, both `ARCHITECTURE.md` |
| Performance optimization | `adaptive-interview-api/docs/PERFORMANCE.md`, `docs/CHANGELOG.md` |
| Security fix | `docs/SECURITY.md` + backend `docs/SECURITY.md`, `docs/CHANGELOG.md` |
| Dependency added/removed | `adaptive-interview-api/docs/SETUP.md` or `docs/SETUP.md`, both `ARCHITECTURE.md` |
| Environment variable added | `adaptive-interview-api/docs/SETUP.md` + `docs/SETUP.md`, `docs/SECURITY.md` |
| Any breaking change | `docs/CHANGELOG.md`, `adaptive-interview-api/docs/API.md` |
| Any new feature | `docs/README.md`, `docs/CHANGELOG.md` |

## Cross-Repo Linking

Use GitHub absolute URLs for cross-repo links so they work on GitHub web, in editors, and in rendered Markdown. Example:

```markdown
[Backend Database Guide](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/DATABASE.md)
```

Within a repo, use relative paths.

## Verification

1. `npm run build` in both repos.
2. Search frontend repo for deleted doc filenames: `grep -R "docs/DATABASE.md\|docs/EVALUATION.md\|docs/OLLAMA.md\|docs/PERFORMANCE.md" --include="*.md" .`
3. Search backend repo for any stale references to frontend paths.
4. Click through each README/docs landing to confirm links resolve.

## Dependencies

No code dependencies. This change touches only Markdown files, `.env.example`, and `CLAUDE.md`.
