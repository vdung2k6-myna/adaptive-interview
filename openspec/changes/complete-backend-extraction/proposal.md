# Proposal: Complete Backend Extraction

## Problem

`D:\Working\Projects\adaptive-interview-api` was scaffolded as a standalone Express backend (see `.claude/plan.md`, now superseded by this OpenSpec change) but **it is not functional**. All complex routes return `501 Not Implemented`:

- `POST /api/messages` → streaming NDJSON conversion missing (275 lines in monolith)
- `POST /api/voice/*` → multipart upload + SSE conversion missing (1,211 lines in monolith)
- `GET /api/evaluations/:id` → evaluation handler conversion missing (181 lines in monolith)
- `GET /api/mcp` → SSE transport conversion missing (91 lines in monolith)

The monolith (`ollama-chat-react`) still contains all backend code — API routes, database access, business logic, Ollama client, MCP server, audio services. This means:
1. The backend repo is **untestable** — you can't run an interview against it.
2. The monolith still carries backend baggage — can't become a pure frontend.
3. Two repos drift apart every time monolith code changes.

## Solution

Complete the backend extraction by converting all `501` stubs into working Express handlers, then strip the backend code from the monolith in a follow-up change.

## Scope

### In Scope (this change)
- Convert `src/routes/messages.ts` → streaming NDJSON with `res.write()`
- Convert `src/routes/voice.ts` → multer multipart uploads + SSE streaming
- Convert `src/routes/evaluations.ts` → Express handler for AI scoring
- Convert `src/routes/mcp.ts` → SSE transport for MCP analytics
- Verify `src/routes/candidates.ts`, `positions.ts`, `sessions.ts`, `campaigns.ts` are complete and correct
- Add CORS middleware, error handling, auth middleware alignment
- Test backend independently (curl/Postman for CRUD, browser for streaming)
- Update `adaptive-interview-api/README.md` with accurate route status

### Out of Scope (this change)
- Stripping backend code from `ollama-chat-react` monolith → separate change (`strip-monolith-backend`)
- Renaming `ollama-chat-react` to `adaptive-interview-ui`
- Converting frontend fetch calls to absolute URLs with CORS
- Deployment configuration (Docker, CI/CD)

## Risks

| Risk | Mitigation |
|------|-----------|
| Streaming format mismatch (NDJSON chunks) | Copy chunk structure exactly from monolith; test with same frontend consumeStream() |
| Multipart audio upload handling | Use `multer` with same field names as monolith; test with same AudioRecorder component |
| SSE voice stream CORS | Configure `cors({ origin })` with credentials; test cross-origin from :3000 → :4000 |
| MCP SSE transport breaks | Use `@modelcontextprotocol/sdk` SSE transport adapter for Express |
| Database migration drift | Keep `migrations/` directory identical between repos until monolith is stripped |

## Success Criteria

- [ ] `npm run build` passes in `adaptive-interview-api`
- [ ] All API routes respond correctly when tested with curl/Postman
- [ ] Text interview works end-to-end against `localhost:4000`
- [ ] Voice interview works end-to-end against `localhost:4000`
- [ ] MCP server SSE connects and responds to tool calls
- [ ] Auth rejects requests without token, accepts with valid token
- [ ] README route status table shows all routes as ✅ Converted
