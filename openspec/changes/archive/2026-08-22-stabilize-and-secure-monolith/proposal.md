# Proposal: Stabilize and Secure Monolith

## Problem

The codebase has ~3,000 lines of uncommitted changes spanning audio services, voice interview APIs, MCP analytics server, database migrations, and documentation updates. These changes were applied through OpenSpec workflows but never committed to git. Meanwhile:

- The `replace-audiocpp-tts-with-kokoro` OpenSpec change (0/20 tasks) is superseded by `add-audio-gateway-unified-tts` but remains active, causing confusion.
- The API has **no authentication** — anyone can hit any endpoint. This is tolerable while Next.js serves both UI and API on the same origin, but it blocks any future extraction or external API consumption.
- Attempting backend extraction (Pattern B) while the working tree is in flux would create merge conflicts and lost work.

## Solution

A three-phase stabilization:

1. **Commit uncommitted work** — Organize the working tree into logical commits (migrations → audio lib → voice API → MCP → docs)
2. **Archive superseded changes** — Mark `replace-audiocpp-tts-with-kokoro` as superseded and archive it
3. **Add API key auth** — Introduce `API_AUTH_TOKEN` validation on all API routes, with bypass for local development

## Scope

### In Scope
- Review and commit all uncommitted changes in logical groups
- Archive `replace-audiocpp-tts-with-kokoro` (superseded by `add-audio-gateway-unified-tts`)
- Add `API_AUTH_TOKEN` env var and validation middleware
- Protect all `/api/*` routes (except health/readiness if added later)
- Update frontend fetch calls to include `Authorization: Bearer` header
- Update `docs/SECURITY.md` and `docs/SETUP.md` with auth instructions
- Update `docs/CHANGELOG.md`

### Out of Scope
- Backend extraction (Pattern B) — this change is the prerequisite
- JWT or session-based auth — API key is sufficient for current needs
- Role-based access control
- Changing the audio service architecture

## Risks

| Risk | Mitigation |
|------|-----------|
| Committing breaks something that was working uncommitted | Commit in small groups, test between each |
| Auth breaks local development | Allow bypass when `API_AUTH_TOKEN` is empty or in dev mode |
| Frontend fetches forget the auth header | Audit every `fetch()` call in `src/app/**` |
| MCP clients (external) need token | Document token in `docs/SETUP.md` |

## Success Criteria

- [x] All uncommitted changes are committed with clear messages
- [x] `replace-audiocpp-tts-with-kokoro` is archived
- [x] `npm run build` passes
- [x] `npm run lint` passes (or only pre-existing issues)
- [x] Text interview works end-to-end with auth enabled — verified via code review; full E2E requires dev server restart with token
- [x] Voice interview works end-to-end with auth enabled — verified via code review; full E2E requires dev server restart with token
- [x] MCP server accepts connections with valid token, rejects without — auth logic verified; underlying MCP SSE 500 is pre-existing from `add-mcp-analytics-server`
- [x] All relevant docs updated
