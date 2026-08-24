# Design: Stabilize and Secure Monolith

## Architecture

No architectural change — this is a **preparation change** that hardens the existing monolith before future extraction.

```
Before:          After (same topology, +auth):
┌──────────┐     ┌──────────┐
│ Next.js  │     │ Next.js  │──┐ Authorization: Bearer <token>
│ (UI+API) │     │ (UI+API) │  │
└────┬─────┘     └────┬─────┘  │
     │                │        │
     ▼                ▼        │
  Postgres        Postgres     │
  Ollama          Ollama       │
  Audio Svcs      Audio Svcs   │
```

## Auth Design

### Token Strategy

- **Single shared secret** (`API_AUTH_TOKEN` env var)
- Passed via `Authorization: Bearer <token>` header
- **No token** = public access (backward compatible for local dev)
- **Token set** = enforced on all `/api/*` routes

This is the simplest possible auth that still enables future extraction.

### Middleware

```typescript
// src/lib/auth.ts
export function validateApiAuth(request: Request): boolean {
  const token = process.env.API_AUTH_TOKEN;
  if (!token) return true; // auth disabled

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  return authHeader.slice(7) === token;
}
```

Applied at the top of every API route:

```typescript
// src/app/api/messages/route.ts
import { validateApiAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!validateApiAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... existing logic
}
```

### Frontend Integration

All `fetch()` calls in client components get the token from a global config:

```typescript
// src/lib/api-client.ts
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (API_TOKEN) {
    headers.set("Authorization", `Bearer ${API_TOKEN}`);
  }
  return fetch(url, { ...init, headers });
}
```

Routes updated:
- `src/app/interview/[id]/page.tsx` — `fetch("/api/messages")` → `apiFetch("/api/messages")`
- `src/app/interview/[id]/voice/page.tsx` — all `fetch()` calls
- `src/app/dashboard/page.tsx` — `fetch("/api/sessions")` etc.
- `src/app/setup/SetupForm.tsx` — `fetch("/api/sessions")`
- `src/app/candidates/page.tsx` — list/create/delete fetches
- `src/app/positions/page.tsx` — list/create/delete fetches
- `src/app/campaigns/page.tsx` — list/create/delete fetches
- `src/app/interview/[id]/transcript/page.tsx` — evaluation fetch

### MCP Auth

The MCP server already has `validateMcpAuth()` in `src/lib/mcp/auth.ts`. It checks `MCP_AUTH_TOKEN`. We align the two tokens:

| Env Var | Purpose | Value |
|---------|---------|-------|
| `API_AUTH_TOKEN` | General API access | Same as `MCP_AUTH_TOKEN` (or separate) |
| `MCP_AUTH_TOKEN` | MCP SSE/POST access | Same as `API_AUTH_TOKEN` (or separate) |

For simplicity, we can make them the same token initially: `API_AUTH_TOKEN` falls back to `MCP_AUTH_TOKEN` if not set.

## Commit Strategy

The uncommitted changes break into these logical groups:

### Commit 1: Database migrations
- `migrations/0006_silent_rachel_grey.sql`
- `migrations/0007_add_tts_provider.sql`
- `migrations/meta/0006_snapshot.json`
- `migrations/meta/0007_snapshot.json`
- `migrations/meta/_journal.json`
- `src/lib/schema.ts` (adds `ttsProvider` column)

### Commit 2: Audio library and services
- `src/lib/audio/**` (all files)
- `audio-gateway/` (new)
- `piper-service/` (new)
- `kokoro-service/` (already gitignored, but README/debug files can be committed)
- `docker-compose.audio.yml`
- `scripts/start-audio-services.*`
- `scripts/stop-audio-services.*`
- `scripts/test-piper.py`, `scripts/test-piper-direct.py`, `scripts/inspect-piper-chunk.py`

### Commit 3: Voice interview API
- `src/app/api/voice/**` (all route files)
- `src/app/interview/[id]/voice/page.tsx`
- `src/components/AudioPlayer.tsx`
- `src/components/AudioRecorder.tsx`
- `src/components/StreamingAudioQueue.tsx`
- `src/app/audio/[[...path]]/route.ts`

### Commit 4: MCP analytics server
- `src/app/api/mcp/route.ts`
- `src/lib/mcp/**` (all files)

### Commit 5: Config and core updates
- `src/lib/config/*.ts`
- `src/app/api/sessions/route.ts`
- `src/app/api/evaluations/[sessionId]/route.ts`
- `src/app/setup/SetupForm.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/interview/[id]/page.tsx`
- `src/app/interview/[id]/transcript/page.tsx`
- `src/lib/prompts.ts`

### Commit 6: Documentation
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/SECURITY.md`
- `docs/SETUP.md`
- `README.md`
- `next.config.ts`
- `eslint.config.mjs`
- `.gitignore`
- `package.json` + `package-lock.json`

## Environment Variables

New or updated:

```bash
# Auth (NEW)
API_AUTH_TOKEN=your-secret-token-here   # Optional; if set, enforces on all API routes

# Audio (already configured but needs docs)
AUDIOCPP_BASE_URL=http://localhost:8080
AUDIO_GATEWAY_URL=http://localhost:8082
DEFAULT_TTS_ENGINE=kokoro
DEFAULT_VOICE=diem_trinh
AUDIOCPP_STT_MODEL=stt

# MCP (already exists)
MCP_ENABLED=true
MCP_AUTH_TOKEN=your-secret-token-here   # Can share with API_AUTH_TOKEN
```

## Testing Plan

1. `npm run build` — passes
2. `npm run lint` — passes (or pre-existing only)
3. Text interview: create session → first question → answer → complete → evaluation
4. Voice interview: create voice session → start → record → stream → complete
5. MCP: connect with `MCP_AUTH_TOKEN` → success; without → 401
6. Auth regression: set `API_AUTH_TOKEN` → all fetches include header → routes validate
