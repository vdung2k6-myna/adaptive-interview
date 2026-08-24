# Proposal: Add MCP Analytics Server

## Problem
Interview data is locked inside PostgreSQL. Recruiters and hiring managers must log into the web dashboard to view candidate evaluations, campaign performance, and session transcripts. External AI assistants (Claude Desktop, Cursor, internal tooling) cannot query this data, limiting productivity for teams already using AI for analysis.

## Solution
Expose a read-only, anonymized MCP server over HTTP (SSE) that provides structured tools for querying interview analytics. External AI clients can discover available tools and invoke them to answer questions like:
- "What was the average technical depth score for the Senior React campaign?"
- "List all sessions completed in the last 7 days."
- "Compare evaluation scores across campaigns."

## Scope
1. Implement an MCP server using the Model Context Protocol SDK
2. Expose tools: `list_campaigns`, `get_campaign_analytics`, `list_sessions`, `get_session_summary`, `list_positions`, `search_candidates_by_skill`
3. Anonymize all candidate data in responses (remove names, emails, CV text; replace with candidate UUID)
4. Expose via SSE transport over a dedicated API route (`/api/mcp`)
5. Add lightweight auth token validation (single `MCP_AUTH_TOKEN` env var)

## Non-goals
- **No write operations** — tools are strictly read-only; no session creation, evaluation modification, or data deletion via MCP
- **No PII exposure** — candidate names, emails, and CVs are never returned
- **No MCP client** — this change is server-only; the AI interviewer will not use tools during live interviews
- **No stdio transport** — only SSE over HTTP for remote access
- **No complex auth** — single shared token, not OAuth or session-based login

## Risks
| Risk | Mitigation |
|------|------------|
| Auth token leaked | Document as shared-secret; recommend rotation in production |
| MCP SDK adds bundle size | Server-side only; lazy-import in route handler |
| Tool schemas drift from DB schema | Add test that validates tool output against Drizzle types |
| Over-exposure of data | Review every field returned by each tool before merge |

## Success Criteria
- [x] Claude Desktop (or `npx @modelcontextprotocol/inspector`) can connect to `/api/mcp`
- [x] All exposed tools return data without PII
- [x] Auth rejects requests with missing or invalid token
- [x] `npm run build` and `npm run lint` pass
- [x] Docs updated: `API.md`, `ARCHITECTURE.md`, `SECURITY.md`, `CHANGELOG.md`
