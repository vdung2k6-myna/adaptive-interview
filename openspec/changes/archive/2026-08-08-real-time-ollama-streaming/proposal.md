# Real-time Ollama Streaming — Proposal

## Problem

The current interview experience waits for Ollama to generate the entire interviewer question before displaying anything to the candidate. During this time the UI shows only a generic bouncing-dots loader. On slower hardware or with longer responses, this creates a perception of sluggishness and disconnects the user from the "AI conversation" feel.

## Solution

Switch Ollama chat generation from `stream: false` to `stream: true`, pipe tokens through a Next.js `ReadableStream`, and render them incrementally in the interview UI. The full message is accumulated server-side and persisted to the database only when the stream completes.

## Scope

**In scope:**
- Switch `generateChatResponse` to consume Ollama's NDJSON stream
- Return `ReadableStream` from `POST /api/messages` in Next.js App Router
- Parse NDJSON chunks in the frontend and render live
- Accumulate full text server-side, store to DB on stream end
- Handle stream interruption and error mid-generation

**Out of scope (for now):**
- Moving embedding off the critical path (separate change)
- WebSockets or persistent connections
- Background job queue
- Partial-message persistence in DB

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Mid-stream failure leaves no DB record | Acceptable UX — show error, candidate retries. No partial rows. |
| Embedding still blocks first token | Acknowledged. Embedding stays on critical path; streaming only improves generation phase. |
| NDJSON parsing complexity | Small, well-tested parser. Ollama's streaming format is stable. |
| Next.js App Router stream support | `ReadableStream` is supported natively in route handlers. |

## Success Criteria

- Candidate sees interviewer tokens appear word-by-word within 500ms of embedding completion
- Full message is persisted to DB after stream completes
- Existing data model (messages table) unchanged
- Error handling preserves current behavior (show error, allow retry)
