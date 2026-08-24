# API Documentation

The Adaptive Interview Engine API is served by the standalone Express backend in `adaptive-interview-api`. The Next.js frontend does not implement any API routes; it delegates every call to the backend.

## Base URL

During development, the frontend's `next.config.ts` rewrites proxy these paths to the backend:

```
http://localhost:3000/api/*  →  http://localhost:4000/api/*
http://localhost:3000/audio/* →  http://localhost:4000/audio/*
```

In production, a reverse proxy (nginx, Vercel, etc.) should do the same.

## Authentication

When the backend has `API_AUTH_TOKEN` configured, every request to `/api/*` must include:

```
Authorization: Bearer <token>
```

Frontend components use `apiFetch()` from `@/lib/api-client`, which automatically injects the header when `NEXT_PUBLIC_API_TOKEN` is set.

## Full API Reference

See the backend documentation for the complete REST API:

- **[adaptive-interview-api/docs/API.md](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/main/docs/API.md)**

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
| MCP | `/api/mcp` | MCP analytics SSE |
| Audio | `/audio/*` | Static audio file serving |

For request/response shapes, SSE event formats, and curl examples, see the backend API reference.
