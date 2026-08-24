# Design: MCP Analytics Server

## Architecture

```
External AI Client (Claude Desktop / Inspector)
         │
         │ HTTP GET /api/mcp (SSE upgrade)
         │ Headers: Authorization: Bearer <token>
         ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js Route Handler — src/app/api/mcp/route.ts        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  MCP Server (ServerInitializer + SSETransport)   │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │  Tool Registry                             │   │   │
│  │  │  - listCampaigns                           │   │   │
│  │  │  - getCampaignAnalytics                    │   │   │
│  │  │  - listSessions                            │   │   │
│  │  │  - getSessionSummary                       │   │   │
│  │  │  - listPositions                           │   │   │
│  │  │  - searchCandidatesBySkill                 │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                              │
│                         ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Anonymized Query Layer — src/lib/mcp/tools.ts   │   │
│  │  (Drizzle ORM queries + field filtering)         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                        PostgreSQL
```

## File Structure

```
src/
├── app/
│   └── api/
│       └── mcp/
│           └── route.ts          # SSE endpoint + auth
├── lib/
│   └── mcp/
│       ├── server.ts             # MCP Server + tool registration
│       ├── transport.ts          # SSE transport wrapper
│       ├── auth.ts               # Token validation
│       └── tools/
│           ├── campaigns.ts      # listCampaigns, getCampaignAnalytics
│           ├── sessions.ts       # listSessions, getSessionSummary
│           ├── positions.ts      # listPositions
│           └── candidates.ts     # searchCandidatesBySkill
```

## Transport: SSE Over HTTP

MCP supports multiple transports. We use SSE because:
- Next.js App Router handles HTTP requests natively
- No subprocess spawning required (unlike stdio)
- Works across networks (unlike stdio)
- Claude Desktop Inspector supports HTTP+SSE

Protocol flow:
```
Client          Server
  │ ──GET /api/mcp─────▶ │
  │  Accept: text/event-stream
  │                    │── upgrade to SSE ──▶│
  │ ◀──tools/list───   │  (server sends tool definitions)
  │ ──tools/call─────▶ │
  │                    │── query DB ────────▶│
  │ ◀──result────────  │
  │ ...repeat...
```

## Tool Definitions

### `listCampaigns`
- **Input:** `{ status?: string }`
- **Output:** Array of `{ id, name, description, status, positionCount, sessionCount }`
- **Anonymization:** N/A (no candidate data)

### `getCampaignAnalytics`
- **Input:** `{ campaignId: string }`
- **Output:** `{ averageScores: { technicalDepth, communicationClarity, problemSolving, relevanceToRole }, totalSessions, completedSessions, topSkills: string[], weakAreas: string[] }`
- **Anonymization:** Aggregates only; no individual candidate data

### `listSessions`
- **Input:** `{ campaignId?: string, status?: string, limit?: number }`
- **Output:** Array of `{ id, positionTitle, level, candidateUuid, status, currentTurn, maxTurns, createdAt }`
- **Anonymization:** `candidate.name` → `candidateUuid` (hashed or random UUID)

### `getSessionSummary`
- **Input:** `{ sessionId: string }`
- **Output:** `{ id, positionTitle, level, candidateUuid, status, messageCount, evaluation?: { scores, recommendation, confidence } }`
- **Anonymization:** No transcript content (too risky); only metadata and scores

### `listPositions`
- **Input:** `{ level?: string }`
- **Output:** Array of `{ id, title, level, requirements, sessionCount }`
- **Anonymization:** N/A

### `searchCandidatesBySkill`
- **Input:** `{ skill: string, limit?: number }`
- **Output:** Array of `{ candidateUuid, matchedSkills, experienceYears }`
- **Anonymization:** Names removed; only skills and experience

## Anonymization Rules

Every tool must apply these filters before returning data:
- **Remove:** `name`, `email`, `cv`, `rawResponse`
- **Replace:** `candidateId` → `candidateUuid` (random stable UUID per candidate, not the DB PK)
- **Truncate:** `jobDescription` to 200 chars if included
- **Exclude:** Full transcripts and message content are never returned via MCP

## Security

### Auth Token
- Env var: `MCP_AUTH_TOKEN` (required; server refuses to start without it)
- Header: `Authorization: Bearer <token>`
- Validation: Exact string match in `src/lib/mcp/auth.ts`
- Rejection: 401 Unauthorized with no body

### Defense in Depth
- Read-only Drizzle queries (no `.delete()`, `.update()` in tool files)
- Input validation on all tool arguments (Zod schemas)
- Rate limiting: optional; can be added at Nginx/Vercel edge layer
- No raw SQL in MCP tool files (only Drizzle query builder)

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP Server + SSE transport |
| `zod` | Tool input validation |

`zod` may already be available as a transitive dependency via Drizzle. Verify before adding.

## Data Flow: Tool Invocation

```
Client sends tools/call
    │
    ▼
MCP Server dispatches to handler by name
    │
    ▼
Handler validates input with Zod
    │
    ▼
Handler queries DB via Drizzle
    │
    ▼
Anonymization layer strips PII
    │
    ▼
JSON result returned to client via SSE
```

## Error Handling

| Error | Response |
|-------|----------|
| Invalid auth token | 401 Unauthorized, close SSE |
| Invalid tool arguments | MCP error: `invalidRequest` |
| DB query fails | MCP error: `internalError` (log server-side, generic message client-side) |
| Resource not found | MCP error: `invalidRequest` with message "Campaign not found" |

## Testing Strategy

1. **Unit tests** (optional): Mock Drizzle, verify anonymization logic
2. **Manual test with Inspector:**
   ```bash
   npx @modelcontextprotocol/inspector node dist/mcp-server.js
   # or connect via HTTP to /api/mcp
   ```
3. **Auth test:** Verify 401 without token, 200 with valid token
4. **PII audit:** For each tool, inspect raw response to confirm no names/emails/CVs

## Performance

- All queries use existing Drizzle indexes (campaign_positions, evaluation_versions)
- `getCampaignAnalytics` aggregates in SQL (AVG, COUNT) rather than fetching all rows
- Default `limit: 50` on list queries; max `limit: 500`
- SSE connection stays open; no polling overhead
