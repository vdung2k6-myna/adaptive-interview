# Tasks: Add MCP Analytics Server

## Prerequisites
- [x] Read `CLAUDE.md` and confirm no conflicts with existing conventions
- [x] Verify `zod` is available (check if Drizzle brings it transitively)

## Phase 1: Dependencies & Config
- [x] `npm install @modelcontextprotocol/sdk zod`
- [x] Add `MCP_AUTH_TOKEN` to `.env.local` and `src/lib/config`
- [x] Add MCP config types to `src/lib/config/index.ts` (authToken, enabled flag)
- [x] Update `docs/SETUP.md` with MCP env var instructions

## Phase 2: Core MCP Infrastructure
- [x] Create `src/lib/mcp/auth.ts` — token validation middleware
- [x] Create `src/lib/mcp/transport.ts` — SSE transport wrapper for Next.js
- [x] Create `src/lib/mcp/server.ts` — MCP Server initialization + tool registry
- [x] Create `src/app/api/mcp/route.ts` — Next.js route handler (GET for SSE, auth check)
- [x] Verify inspector can connect and receive `tools/list`

## Phase 3: Tool Implementations
- [x] Create `src/lib/mcp/tools/campaigns.ts` — `listCampaigns`, `getCampaignAnalytics`
- [x] Create `src/lib/mcp/tools/sessions.ts` — `listSessions`, `getSessionSummary`
- [x] Create `src/lib/mcp/tools/positions.ts` — `listPositions`
- [x] Create `src/lib/mcp/tools/candidates.ts` — `searchCandidatesBySkill`
- [x] Create `src/lib/mcp/tools/_anonymize.ts` — shared PII stripping utilities
- [x] Wire all tools into `server.ts`

## Phase 4: Testing & Validation
- [x] Manual test: Connect MCP Inspector to `/api/mcp`
- [x] Manual test: Call each tool, verify response shape
- [x] PII audit: Confirm no names, emails, CVs, or rawResponse in any tool output
- [x] Auth test: Verify 401 without token, 200 with valid token
- [x] Run `npm run build` — no errors
- [x] Run `npm run lint` — no new errors (remaining errors are pre-existing)

## Phase 5: Documentation
- [x] Update `docs/API.md` — document MCP endpoint, auth, and available tools
- [x] Update `docs/ARCHITECTURE.md` — add MCP server to architecture diagram
- [x] Update `docs/SECURITY.md` — document MCP auth model and anonymization rules
- [x] Update `docs/CHANGELOG.md` — add entry for MCP analytics server
- [x] Update `docs/COMPONENTS.md` — add MCP section (if applicable)
- [x] Update `docs/README.md` — mention MCP capability in features list
- [x] Update `docs/SETUP.md` — MCP env var instructions
