# Plan: Implement Voice Routes in Backend

## Problem

The backend `adaptive-interview-api` has 5 voice endpoints (`/api/voice/*`) that all return `501 Not Implemented`. The frontend depends on these for voice interview mode and transcript TTS replay.

The backend already contains:
- Complete audio library (`src/lib/audio/`) with STT, TTS, storage, text processing
- Audio service configs and clients
- Multer dependency installed
- `/audio` static file serving
- Auth middleware applied

## What We'll Do

Rewrite `src/routes/voice.ts` to implement all 5 endpoints, adapting the logic from the original Next.js route handlers (still in git history).

## Files to Change

| File | Action |
|------|--------|
| `src/routes/voice.ts` | Replace all 501 stubs with full implementations |

## Implementation Details

### 1. `POST /api/voice/start`
**Flow:**
- Receive JSON `{ sessionId }`
- Validate session exists, is voice mode, has no messages yet
- Fetch candidate + position
- Build prompt (empty history) → call Ollama
- TTS synthesize → save audio → store message
- Update session status to `in_progress`
- Return `{ success, interviewerMessage, session }`

### 2. `POST /api/voice/turn` (Multipart)
**Flow:**
- Multer `upload.single("audio")` parses multipart form
- Validate session (voice mode, not completed)
- Save candidate audio buffer → STT → store candidate message
- Build prompt with existing messages → call Ollama
- Handle final turn: mark completed, synthesize completion message
- TTS synthesize question → save audio → store interviewer message
- Update session turn
- Return `{ success, candidateMessage, interviewerMessage, session }`

### 3. `POST /api/voice/stream` (Multipart + SSE)
**Flow:**
- Multer `upload.single("audio")` parses multipart form
- Same validation as `/turn`
- Save + STT candidate audio → emit `candidate` SSE event
- Build prompt → stream LLM tokens with sentence detection
- For each completed sentence: fire TTS in background → emit `sentence` SSE event (ordered)
- Flush remaining tail text as final sentence
- Wait for all TTS → concatenate WAVs → save combined audio
- Store interviewer message → update session
- Emit `done` SSE event with session state and message ID

### 4. `POST /api/voice/speak`
**Flow:**
- Receive JSON `{ text, voice?, engine? }`
- Strip markdown → synthesize speech
- Return audio Buffer with `Content-Type: audio/wav`

### 5. `POST /api/voice/speak-stream` (SSE)
**Flow:**
- Receive JSON `{ text, engine?, sessionId? }`
- Strip markdown → split sentences
- For each sentence: TTS → save audio → emit `sentence` SSE event
- Emit `done` SSE event

## Key Design Decisions

1. **Multer memoryStorage** — Audio files are small (< 1MB); memoryStorage avoids temp file cleanup complexity. Buffer passed directly to STT.

2. **SSE helper function** — Extract a `sendEvent(res, event, data)` helper for consistent SSE formatting with `res.write()`.

3. **Ordered sentence emission** — `/voice/stream` uses a `resolvedMap` + `nextEmitIndex` pattern to emit sentences in order as each TTS completes, matching the original monolith behavior.

4. **Error handling** — Each endpoint catches errors and returns appropriate status codes (400, 404, 500). SSE endpoints emit `error` events before closing.

5. **Auth** — Already handled by global `apiAuthMiddleware` in `index.ts`.

## Dependencies

Already installed:
- `multer` + `@types/multer` — multipart parsing
- All audio library dependencies (`src/lib/audio/*`)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Audio services (STT/TTS) not running | Already handled — routes will return 500 with descriptive error; health checks exist separately |
| Large audio files in memory | Voice recordings are typically < 500KB; memoryStorage is acceptable |
| SSE connection dropped mid-stream | `res.write()` errors are caught; stream ends gracefully |

## Testing Plan

After implementation:
1. `npx tsc --noEmit` passes
2. Backend starts without errors
3. `POST /api/voice/start` with valid sessionId → returns question + audioUrl
4. `POST /api/voice/speak` with text → returns WAV audio buffer
5. `POST /api/voice/speak-stream` with text → SSE stream with sentence events

## Out of Scope

- Re-implementing the audio services (audio-gateway, kokoro-service, piper-service) — they already exist on disk in the backend repo
- Changing frontend code — these are backend-only route fixes

## Estimation

- One file (`voice.ts`) — ~350 lines
- Straightforward adaptation from existing Next.js routes
- Low risk since originals are well-tested
