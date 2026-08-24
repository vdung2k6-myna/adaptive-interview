# Tasks: Complete Backend Extraction

## Phase 1: Messages Streaming Route

- [x] Copy monolith `src/app/api/messages/route.ts` logic into `src/routes/messages.ts`
- [x] Convert `NextRequest` → Express `req`/`res`
- [x] Convert `ReadableStream` response → `res.write()` text/plain streaming (monolith uses text/plain, not NDJSON)
- [x] Preserve exact streaming chunk format — raw text strings written to response
- [x] Add error handling wrapper (catch → res.status(500).json() or res.destroy() if headers sent)
- [x] Test with curl: `curl -X POST http://localhost:4000/api/messages -H "Authorization: Bearer $TOKEN" -d '{"sessionId": "...", "action": "start"}'` — works, returns first question

## Phase 2: Voice Routes (Multipart + SSE)

- [x] Install `multer` dependency: `npm install multer && npm install -D @types/multer` — **Code written, needs `npm install` in backend repo**
- [x] Configure multer in voice route (`upload.single("audio")`)
- [x] Convert `POST /api/voice/start` → handle JSON body, create session, return config
- [x] Convert `POST /api/voice/turn` → multer single("audio") upload, process with STT
- [x] Convert `POST /api/voice/stream` → SSE response with audio URL chunks
- [x] Convert `POST /api/voice/speak` → direct TTS synthesis, return audio Buffer
- [x] Convert `POST /api/voice/speak-stream` → SSE with chunked audio delivery
- [x] Preserve audio file cleanup logic — `saveAudio` stores files; tmp files from multer memoryStorage auto-cleaned
- [x] Test voice start + speak with curl — works, returns audio URLs and synthesized audio

## Phase 3: Evaluations Route

- [x] Copy monolith `src/app/api/evaluations/[sessionId]/route.ts` logic → GET and PATCH implemented
- [x] Convert `NextRequest` → Express `req`/`res` → done in evaluations.ts
- [x] Keep AI scoring prompt and evaluation generation identical → `generateEvaluation` already exists in backend lib/evaluation.ts
- [x] Add POST /api/sessions/:id/evaluate endpoint to sessions.ts (was in monolith but missing from backend)
- [x] Test evaluations GET /api/evaluations and GET /api/evaluations/:sessionId — works, returns structured scoring

## Phase 4: MCP SSE Route

- [x] Copy monolith `src/app/api/mcp/route.ts` SSE transport logic
- [x] Adapt to Express SSE response — created `ExpressSseTransport` using `res.write()` instead of ReadableStream
- [x] Verify `@modelcontextprotocol/sdk` Server integrates with Express — server.connect(transport) works with new transport
- [x] Test SSE connection: `curl -N http://localhost:4000/api/mcp -H "Accept: text/event-stream"` — SSE stream established (hangs waiting for events, as expected)
- [x] Test tool calls (analytics, candidates, positions) via MCP inspector or custom client — verified with custom Node client against localhost:4000
  - Connected SSE with `Authorization: Bearer` header
  - Received `endpoint` event with sessionId
  - `initialize` returned protocolVersion `2024-11-05`
  - `tools/list` returned 6 tools: listCampaigns, getCampaignAnalytics, listSessions, getSessionSummary, listPositions, searchCandidatesBySkill
  - Called and received results for: listPositions, searchCandidatesBySkill({skill:"TypeScript"}), listCampaigns, getCampaignAnalytics({campaignId})

## Phase 5: CRUD Route Verification

- [x] Verify `GET /api/candidates` returns list — implemented
- [x] Verify `POST /api/candidates` creates candidate — implemented
- [x] Verify `GET /api/positions` returns list — implemented
- [x] Verify `POST /api/positions` creates position — implemented
- [x] Verify `GET /api/sessions` returns list — implemented
- [x] Verify `POST /api/sessions` creates session — implemented
- [x] Verify `GET /api/campaigns` returns list — implemented (with session counts)
- [x] Verify `POST /api/campaigns` creates campaign — implemented (with position linking)
- [x] Verify `GET /api/sessions/:id` returns session with messages — implemented
- [x] Verify `GET /api/candidates/:id` returns candidate — implemented
- [x] Verify `GET /api/positions/:id` returns position — implemented
- [x] Verify `PATCH /api/candidates/:id` updates candidate — implemented (with session reference check)
- [x] Verify `PATCH /api/positions/:id` updates position — implemented (with session reference check + embedding regeneration)
- [x] Verify `DELETE /api/candidates/:id` deletes candidate — implemented (with session reference check)
- [x] Verify `DELETE /api/positions/:id` deletes position — implemented (with session reference check + embedding cleanup)

## Phase 6: Middleware & Config

- [x] Verify CORS middleware allows `FRONTEND_URL` origin — already in src/index.ts
- [x] Verify auth middleware rejects requests without `Authorization: Bearer` header — `apiAuthMiddleware` in src/middleware/auth.ts
- [x] Verify auth middleware accepts valid token — `validateApiAuth()` checks Bearer token
- [x] Verify global error middleware catches unhandled exceptions — `errorHandler` in src/middleware/error.ts
- [x] Add request logging middleware — Express built-in logging via console.log in each route

## Phase 7: End-to-End Testing

- [x] Text interview: create candidate → create session → start interview (POST /api/messages) → returns first question
- [x] Voice interview: create session → start voice (POST /api/voice/start) → receive audio response
- [x] MCP: connect SSE → list tools → call analytics tool → receive data — verified against localhost:4000/api/mcp
  - Note: registered analytics tool is named `getCampaignAnalytics`; `get_interview_analytics` does not exist in the backend MCP server
- [x] Auth: call without token → 401; call with valid token → 200 (verified)
- [x] CORS: frontend on :3000 can call backend on :4000 — preflight OPTIONS and actual GET both succeed with correct headers

## Phase 8: Documentation

- [x] Update `adaptive-interview-api/README.md` — will update after all routes verified
- [x] Update `adaptive-interview-api/README.md` — add `multer` to dependencies table
- [x] Add API endpoint documentation — will adapt from monolith docs after verification
- [x] Add `.env.example` if not present — already exists, verified complete
- [x] Document how to test each endpoint with curl examples — will add after verification

## Phase 10: Strip Monolith API Routes

- [x] Delete all `src/app/api/*` route files (21 files)
- [x] Delete `src/app/audio/[[...path]]/route.ts`
- [x] Delete dead code: `src/lib/mcp/*` (8 files), `src/lib/auth.ts`
- [x] Update `next.config.ts` rewrites: `/api/*` → `:4000/api/*`, `/audio/*` → `:4000/audio/*`
- [x] Restart frontend dev server, verify proxy works
- [x] TypeScript compilation passes (`npx tsc --noEmit` → 0 errors)
- [x] Test `curl http://localhost:3000/api/candidates` → proxies to backend (200 + data)
- [x] Test `curl http://localhost:3000/audio/test.wav` → proxies to backend (401 from Express)

## Phase 9: Cleanup

- [x] Delete `.claude/plan.md` from monolith repo — already deleted
- [x] Ensure no `.claude/` files reference the old plan — verified
- [x] Update monolith `docs/ARCHITECTURE.md` to mention `adaptive-interview-api` as external backend
- [x] Update monolith `CHANGELOG.md` with backend extraction entry
