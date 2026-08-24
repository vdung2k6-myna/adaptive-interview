# Design: Complete Backend Extraction

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Express Backend (:4000)                           │
├─────────────────────────────────────────────────────────────────────┤
│  Auth Middleware (validateApiAuth)                                   │
│       ↓                                                            │
│  CORS Middleware (origin: FRONTEND_URL)                            │
│       ↓                                                            │
│  Body Parser (json, urlencoded, multer for multipart)              │
│       ↓                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ /api/candidates│  │ /api/positions │  │ /api/sessions  │             │
│  │   (CRUD)      │  │   (CRUD)       │  │   (CRUD)       │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ /api/campaigns │  │ /api/messages │  │ /api/voice    │             │
│  │   (CRUD)      │  │   (Streaming)  │  │   (Multipart+SSE)│             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │ /api/evaluations│  │ /api/mcp      │                                │
│  │   (AI Scoring) │  │   (SSE Analytics)│                                │
│  └──────────────┘  └──────────────┘                                │
│       ↓                                                            │
│  Business Logic (lib/prompts.ts, evaluation.ts, ollama.ts)          │
│       ↓                                                            │
│  Data Access (lib/db.ts, schema.ts)                                 │
│       ↓                                                            │
│  PostgreSQL + pgvector                                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Design

### Route Conversion Pattern

Next.js → Express mapping:

| Monolith | Backend | Notes |
|----------|---------|-------|
| `export async function POST(req: NextRequest)` | `router.post("/", async (req, res) => { ... })` | Request shape changes |
| `await req.json()` | `req.body` (with `express.json()`) | Body parsing |
| `await req.formData()` | `multer.single("audio")` | File uploads |
| `return NextResponse.json(data, { status: 201 })` | `res.status(201).json(data)` | JSON responses |
| `return new NextResponse(stream, { headers })` | `res.writeHead(200, headers); res.write(chunk)` | Streaming |

### Streaming NDJSON (/api/messages)

```typescript
// Express streaming pattern
res.setHeader("Content-Type", "application/x-ndjson");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

for await (const chunk of ollamaStream) {
  res.write(JSON.stringify(chunk) + "\n");
}
res.end();
```

Must match monolith's exact chunk shape:
```typescript
{ message: { role: "assistant", content: string }, done: boolean }
```

### Multipart Audio (/api/voice/*)

```typescript
import multer from "multer";
const upload = multer({ dest: os.tmpdir() });

router.post("/turn", upload.single("audio"), async (req, res) => {
  // req.file.buffer contains the uploaded audio
  // req.body contains form fields (sessionId, turnIndex, etc.)
});
```

### SSE (/api/voice/stream, /api/mcp)

```typescript
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL); // NOT *

// For voice stream
res.write(`data: ${JSON.stringify({ type: "audio", url: "..." })}\n\n`);

// For MCP
// Use @modelcontextprotocol/sdk Server with custom transport
```

## Security

- `API_AUTH_TOKEN` validated on every route (already in `src/middleware/auth.ts`)
- CORS origin explicitly configured, not wildcard (`*`)
- No raw SQL — use Drizzle ORM query builder
- Audio file uploads validated (size limit, WAV format check)

## Dependencies

Already present in `package.json`:
- `express`, `cors`, `multer` — routing, CORS, file uploads
- `@modelcontextprotocol/sdk` — MCP server
- `drizzle-orm`, `pg` — database
- `tsx` — dev runner

No new dependencies needed for this change.

## Testing Strategy

1. **Unit tests per route** — curl commands for each endpoint
2. **Integration test** — Full interview flow: create session → send messages → get evaluation
3. **Voice test** — Upload audio → get response → play audio
4. **MCP test** — SSE connection → list tools → call analytics tool

## Data Flow

```
Frontend (:3000) ──HTTP──▶ Express (:4000)
                              │
                              ├─▶ Auth middleware
                              ├─▶ Route handler
                              ├─▶ Business logic (lib/)
                              ├─▶ Drizzle ORM
                              └─▶ PostgreSQL
```

For streaming:
```
Frontend ──POST──▶ /api/messages
                     │
                     ▼
                   res.write(chunk) ──▶ Frontend ReadableStream
```

## Error Handling

```typescript
// Global error middleware (src/middleware/error.ts)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal server error" });
});
```

Each route wraps async handlers to catch errors and prevent unhandled rejections.
