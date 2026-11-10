# API Documentation

The Adaptive Interview Engine API is served by the standalone Express backend in `adaptive-interview-api`. The Next.js frontend's catch-all API route forwards requests to the backend and injects `NEXT_PUBLIC_API_TOKEN` server-side.

## Base URL

API requests pass through the Next.js server-side proxy in development and production:

```
http://localhost:3000/api/*  →  Next.js proxy  →  http://localhost:4000/api/*
http://localhost:3000/audio/* → Next.js rewrite → http://localhost:4000/audio/*
```

Set `NEXT_PUBLIC_BACKEND_URL` when the backend is not available at `http://localhost:4000` from the Next.js server. It names the backend origin as the server reaches it, never the app's own origin (the proxy answers `502` for that), and it is inlined at build time, so a change requires a rebuild and restart (`docs/SETUP.md` §2).

## Authentication

When the backend has `API_AUTH_TOKEN` configured, set the same value in the Next.js server environment as `NEXT_PUBLIC_API_TOKEN`. The proxy adds it to forwarded requests; browser requests do not need to include the secret. If backend authentication is disabled, leave the frontend variable unset and the proxy forwards requests without an authorization header:

```
Authorization: Bearer <token>
```

Frontend components use `apiFetch()` from `@/lib/api-client` to send requests through the proxy.

## Full API Reference

See the backend documentation for the complete REST API:

- **[adaptive-interview-api/docs/API.md](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/API.md)**

## Endpoints at a Glance

| Area | Path | Purpose |
|------|------|---------|
| Candidates | `/api/candidates` | CRUD candidates |
| Positions | `/api/positions` | CRUD positions |
| Sessions | `/api/sessions` | Interview sessions |
| Campaigns | `/api/campaigns` | Recruiting campaigns |
| Messages | `/api/messages` | Streaming interview chat |
| Evaluations | `/api/evaluations/*`, `/api/sessions/:id/evaluate` | AI scoring + calibration |
| Voice | `/api/voice/*` | Voice interview + TTS |
| Voice Agent | `/api/voice-agent/stream` | Ephemeral voice/text agent chat |
| MCP | `/api/mcp` | MCP analytics SSE |
| Audio | `/audio/*` | Static audio file serving |

### Streaming TTS Event Schema

`POST /api/voice/speak-stream` (used by the transcript **Speak** button) emits Server-Sent Events. Each `sentence` event carries the synthesized audio inline:

| Event | Data Shape | Description |
|-------|-----------|-------------|
| `sentence` | `{ index, text, audioData }` | `audioData` is a base64-encoded audio buffer (WAV). `null` means the chunk could not be synthesized. |
| `done` | `{}` | All sentences processed |
| `error` | `{ message }` | Fatal error (stream terminates) |

For request/response shapes, full SSE event formats, and curl examples, see the backend API reference.
