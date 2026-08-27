# Architecture

## System Overview

The Adaptive Interview Engine follows a **separated frontend/backend architecture** (Pattern B). The Next.js frontend handles presentation and delegates all API calls to a standalone Express backend.

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Pages   │  │ Components│  │  Hooks   │  │  Styles  │   │
│  │(React)   │  │(React)   │  │(useState)│  │(Tailwind)│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                          │
              fetch() / apiFetch()
                          │
┌─────────────────────────┴───────────────────────────────────┐
│           Next.js Rewrites (dev proxy)                        │
│              /api/*  →  http://localhost:4000/api/*            │
│              /audio/* → http://localhost:4000/audio/*           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                     BACKEND (Express)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ /api/    │  │ /api/    │  │ /api/    │  │ /api/    │   │
│  │ sessions │  │ messages │  │positions │  │candidates│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│  ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   │
│  │ Route   │   │ Route   │   │ Route   │   │ Route   │   │
│  │Handlers │   │Handlers │   │Handlers │   │Handlers │   │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                          │
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ prompts.ts│  │ ollama.ts│  │evaluation│  │embeddings│   │
│  │(Prompt   │  │(Ollama   │  │  .ts     │  │  .ts     │   │
│  │ Builder) │  │ Client)  │  │(Scoring) │  │(Vectors) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                          │
┌─────────────────────────────────────────────────────────────┐
│                     DATA ACCESS LAYER                        │
│  ┌──────────┐  ┌──────────┐                               │
│  │   db.ts   │  │ schema.ts │                               │
│  │(Drizzle  │  │(Table    │                               │
│  │  Pool)   │  │Defs)    │                               │
│  └────┬─────┘  └────┬─────┘                               │
└───────┼─────────────┼───────────────────────────────────────┘
        │             │
   ┌────┴────┐   ┌────┴────┐
   │PostgreSQL│   │ pgvector │
   │(Tables)  │   │(Extension│
   └─────────┘   └─────────┘
```

**Note:** All Next.js pages are pure frontend Client Components. Every data fetch goes through `apiFetch()` to the backend Express server. The monolith contains no database code, no Drizzle schema, and no business logic — only presentation components, a lightweight `src/lib/api-client.ts`, and type definitions in `src/lib/types.ts`.

## Backend Extraction (Pattern B)

The API layer has been extracted into a standalone Express server in `adaptive-interview-api/` (port 4000). The Next.js monolith retains the frontend presentation layer and delegates all API calls to the Express backend.

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                        │
│  Pages, Components, Hooks, Styles (port 3000)                  │
└──────────────────────────────┬────────────────────────────────┘
                               │
                    fetch() / API routes
                               │
┌──────────────────────────────┴────────────────────────────────┐
│                     BACKEND (Express)                         │
│  /api/candidates, /api/positions, /api/sessions,            │
│  /api/messages, /api/evaluations, /api/voice, /api/mcp       │
│  (port 4000)                                                  │
└──────────────────────────────┬────────────────────────────────┘
                               │
                    Drizzle ORM + pgvector
                               │
                    PostgreSQL (port 5432)
```

**Why:** Enables independent scaling of frontend and backend, simplifies deployment, and allows the backend to run as a long-lived service separate from the Next.js serverless runtime.

## Key Design Patterns

### 1. Turn-Based Session Model

Interviews are structured as turn-based sessions with a configurable maximum (default 8 turns). Each turn consists of:

1. **Interviewer question** — Generated by Ollama based on position requirements, candidate background, and conversation history
2. **Candidate answer** — Typed by the user in the chat UI (text mode) or recorded via microphone (voice mode)

The session automatically completes when `currentTurn >= maxTurns`.

Sessions have a `mode` field: `"text"` (default) or `"voice"`. Voice mode requires:
- **audio.cpp** (port 8080) for speech-to-text transcription
- **Audio Gateway** (port 8082) for text-to-speech synthesis, which routes to either **Kokoro** (port 8081) or **Piper** (port 8083) based on the session's `ttsProvider` field.

These services are part of the `adaptive-interview-api` backend repository; the frontend only communicates with the backend Express server.

### 2. Streaming Architecture

The interviewer response streams token-by-token using Ollama's `stream: true` mode:

```
Ollama → NDJSON chunks → Next.js ReadableStream → Client EventSource/fetch reader
```

On the client, chunks are batched to React state updates every ~50ms to prevent excessive re-renders.

### 3. Vector-Based Topic Tracking

Position requirements are embedded (vectorized) when a position is created. During the interview, each message is also embedded. A cosine similarity query determines which requirements have been "covered" by the conversation.

This drives the adaptive questioning — the prompt includes "Topics already covered" and "Remaining topics to explore" sections.

### 4. Evaluation Pipeline

After an interview completes, a separate evaluation process:

1. Fetches the full transcript
2. Builds an evaluation prompt with position requirements and candidate background
3. Sends to Ollama with `temperature: 0.3` for consistency
4. Parses structured JSON response (4 dimension scores + strengths/weaknesses + recommendation)
5. Stores results in the `evaluations` table

## Data Flow: Interview Session

```
User clicks "Start Interview"
    │
    ▼
POST /api/sessions ──→ Express backend creates session row (status: "created")
    │
    ▼
Redirect to /interview/{id}
    │
    ▼
GET /api/sessions/{id} ──→ Backend loads session + candidate + position
    │
    ▼
If messages.length === 0:
    POST /api/messages (no content) ──→ Backend triggers first question
        │
        ▼
    buildPrompt() ──→ Assemble Ollama context (backend)
        │
        ▼
    generateChatResponseStream() ──→ Backend calls Ollama /api/chat (stream: true)
        │
        ▼
    Return text/plain stream ──→ Client receives NDJSON chunks
        │
        ▼
    Client batches updates every 50ms ──→ Render with MarkdownRenderer
        │
        ▼
    Stream completes ──→ Backend persists full message to DB
        │
    currentTurn increments
    │
User types answer ──→ POST /api/messages (with content)
    │
    ▼
    (Same pipeline generates next question)
    │
After maxTurns:
    Session status → "completed"
    Evaluation becomes available
```

## File Organization

### Frontend (This Repository)

```
src/
├── app/                          # Next.js App Router (pages)
│   ├── candidates/               # Candidate list page (Client Component, apiFetch)
│   ├── candidates/new/           # Candidate creation form (Client Component)
│   ├── candidates/[id]/edit/     # Candidate edit form (Client Component)
│   ├── compare/                  # Side-by-side candidate comparison (Client Component)
│   ├── dashboard/                # Recruiter dashboard (Client Component, apiFetch)
│   ├── interview/[id]/           # Live interview chat (Client Component, apiFetch)
│   │   ├── voice/                # Voice interview page (Client Component, apiFetch)
│   │   └── transcript/           # Post-interview review (Client Component, apiFetch)
│   ├── positions/                # Position list page (Client Component, apiFetch)
│   ├── positions/new/            # Position creation form (Client Component)
│   ├── positions/[id]/edit/      # Position edit form (Client Component)
│   ├── campaigns/                # Campaign list page (Client Component, apiFetch)
│   ├── campaigns/new/            # Campaign creation form (Client Component)
│   ├── campaigns/[id]/           # Campaign detail + report (Client Component, apiFetch)
│   ├── setup/                    # Interview setup (Client Component, apiFetch)
│   ├── error.tsx                 # Global error boundary
│   ├── globals.css               # Global styles + Markdown theme
│   ├── layout.tsx                # Root layout with nav + fonts + PWA registration
│   └── page.tsx                  # Landing → redirect to dashboard
├── components/                   # Shared React components
│   ├── DeleteButton.tsx          # Client delete button with confirmation
│   ├── MarkdownRenderer.tsx      # Rich Markdown rendering with syntax highlighting
│   ├── AudioPlayer.tsx           # HTML5 audio playback
│   ├── AudioRecorder.tsx         # Microphone capture + waveform
│   ├── StreamingAudioQueue.tsx   # Sentence-level audio queue
│   ├── ScoreInput.tsx            # Star score input
│   ├── ModelBadge.tsx            # Model name badge
│   ├── VersionHistory.tsx        # Evaluation version list
│   └── MobileNav.tsx             # Small-screen hamburger navigation
└── lib/                          # Frontend utilities only
    ├── api-client.ts             # Browser fetch wrapper with Bearer token injection
    ├── config/                   # Frontend environment-specific config
    │   ├── index.ts                # Active config export
    │   ├── development.ts          # Dev settings
    │   └── production.ts           # Production settings
    ├── types.ts                  # Lightweight TypeScript interfaces
    ├── use-playback-rate.ts      # Persistent AI voice playback-rate hook
    └── audio/                    # Client-side audio queue only
        └── sentence-queue.ts       # Sequential audio playback with punctuation pauses
```

### Backend (`adaptive-interview-api`)

The backend repository contains:

- **Express server** (`server.ts` / `app.ts`) — port 4000
- **API route handlers** — all CRUD, streaming, voice, evaluations, MCP
- **Drizzle ORM** — same schema, separate `db.ts` connection
- **Business logic** — `prompts.ts`, `ollama.ts`, `evaluation.ts`, `embeddings.ts`
- **MCP analytics server** — SSE transport, tool registry, anonymization
- **Voice pipeline** — multer multipart, STT/TTS orchestration, SSE streaming
- **Audio services** — Audio Gateway, Kokoro, Piper, startup scripts
- **Authentication** — Bearer token validation middleware

## MCP Analytics Server Architecture

> **Location:** The MCP server lives in the `adaptive-interview-api` backend repository. The frontend does not expose `/api/mcp`.

A read-only MCP server exposes anonymized interview data to external AI clients via SSE over HTTP.

```
External AI Client (Claude Desktop / Inspector)
         │
         │ HTTP GET /api/mcp (SSE upgrade)
         │ Headers: Authorization: Bearer <token>
         ▼
┌─────────────────────────────────────────────────────────┐
│  Express Route Handler — adaptive-interview-api          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  MCP Server (McpServer + ExpressSseTransport)     │   │
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
│  │  Anonymized Query Layer                         │   │
│  │  (Drizzle ORM queries + PII stripping)           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                        PostgreSQL
```

**Security model:**
- `MCP_AUTH_TOKEN` required via `Authorization: Bearer` header
- All tools are read-only (no `.delete()`, `.update()` in tool files)
- PII stripped: names, emails, CVs, and raw responses are never returned
- `candidateId` replaced with stable anonymized UUIDs

## Voice Interview Architecture

Voice interviews use the same turn-based model as text, but with audio input/output. The voice pipeline is implemented in the **Express backend** (`adaptive-interview-api`).

### Standard Turn (`POST /api/voice/turn`)

Fully sequential — candidate waits for STT → LLM → TTS before hearing audio (~16–20s).

```
Candidate Browser
    │
    ▼
AudioRecorder (MediaRecorder API) → audio/webm Blob
    │
    ▼
POST /api/voice/turn (multipart: sessionId + audio)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Express Backend                                         │
│  1. Save blob → /tmp/audio/{sessionId}/                  │
│  2. STT: POST audio.cpp /v1/audio/transcriptions        │
│  3. Store candidate message (content = transcription)    │
│  4. Build prompt → call Ollama (non-streaming)           │
│  5. TTS: POST Audio Gateway /v1/audio/speech              │
│     { text, engine: session.ttsProvider }               │
│  6. Save response audio                                  │
│  7. Store interviewer message (content + audioUrl)       │
│  8. Return JSON { candidateMessage, interviewerMessage } │
└─────────────────────────────────────────────────────────┘
    │
    ▼
AudioGateway → routes to Kokoro (:8081) or Piper (:8083)
    │
    ▼
AudioPlayer → HTML5 <audio> playback
```

### Streaming Turn (`POST /api/voice/stream`)

Sentence-level incremental TTS with SSE. The candidate hears the first sentence within ~5–6s because TTS fires **as soon as a sentence boundary is detected in the LLM token stream** — not after the full response is complete.

```
Candidate Browser
    │
    ▼
AudioRecorder → audio/webm Blob
    │
    ▼
POST /api/voice/stream (SSE)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Express Backend                                         │
│  1. Save blob → STT → store candidate message          │
│     emit SSE: event=candidate                            │
│                                                          │
│  2. WHILE streaming LLM tokens:                        │
│       accumulatedText += token                         │
│       if sentence delimiter detected (.!?…。？！):      │
│         extract sentence → fire TTS in background       │
│         (don't await — keep reading tokens)            │
│                                                          │
│  3. After LLM done: flush remaining text as final sentence│
│     await TTS results in order → emit SSE: event=sentence│
│     (events emitted sequentially: index 0, 1, 2...)     │
│                                                          │
│  4. Concatenate all sentence WAVs → store full message  │
│     emit SSE: event=done                                 │
└─────────────────────────────────────────────────────────┘
    │
    ▼
StreamingAudioQueue → plays chunks sequentially, preloads next
```

**Why this is faster:**
- Standard: `STT(3s) + LLM(8s) + TTS(5s) = ~16s` before audio plays
- Streaming (batch): `STT(3s) + LLM(8s) + parallel TTS(2s) = ~13s`, first audio at ~11s
- Streaming (incremental): `STT(3s) + first sentence complete(~4s) + TTS(1s) = ~8s`, first audio at ~5–6s

**Text Preprocessing Pipeline (backend):**
Before any TTS call, text passes through the backend's text-processing module:
- `stripMarkdown()` — removes formatting (bold, italic, headers, code blocks, inline code, lists, blockquotes) so TTS engines don't speak asterisks or backticks
- `splitForTTS(text, maxChars=60)` — splits long sentences into phoneme-safe chunks. Prefers strong boundaries (`:` > `;` > `,` > `space`) to keep clauses intact
- `synthesizeSpeechWithFallback()` — recursive retry: if a chunk exceeds the engine's phoneme limit (~510), it is split in half and retried. For WAV outputs (Piper), successful halves are concatenated so no audio is lost

**Key differences from text mode:**
- Sentence boundaries detected incrementally during LLM streaming, not after full response
- TTS calls run in background during LLM generation; results awaited in order after LLM completes
- Audio files stored on local filesystem (`/tmp/audio/{sessionId}/`) by the backend
- Messages table has audio metadata columns (`audioUrl`, `audioFormat`, `audioDurationSeconds`, `sttConfidence`)
- First question uses dedicated `POST /api/voice/start` endpoint

### Audio Playback Cancellation

Both the transcript page and the voice interview page use a **generation-counter + AbortController** pattern so that Stop actions and new turns reliably cancel every in-flight audio operation.

**Transcript page (`src/app/interview/[id]/transcript/page.tsx`)**
- A monotonic `speakGenerationRef` is incremented on every **Speak** and **Stop** click.
- A shared `AbortController` (`speakAbortRef`) is created at the start of a streaming Speak request and is also passed to the non-streaming fallback path.
- `SentenceAudioQueue.stop()` cancels the current source, clears pending timers, and drops queued items.
- The fallback path checks the generation and `signal.aborted` before decoding or playing; if Stop happened while the combined-audio fetch was in flight, playback never starts.
- Stale SSE readers (from a superseded message or an old Stop) detect the generation mismatch and return without mutating UI state.
- Streaming replay via `POST /api/voice/speak-stream` receives each sentence as base64 `audioData` in the SSE `sentence` event. The frontend decodes the buffer and hands it directly to `SentenceAudioQueue`, eliminating the per-chunk URL fetch and letting the first sentence play as soon as it is synthesized.

**Voice interview page (`src/app/interview/[id]/voice/page.tsx`)**
- A per-turn `turnGenerationRef` is incremented every time the candidate finishes a recording.
- `turnAbortRef` holds the current turn's `AbortController`; the previous controller is aborted when a new turn starts.
- The SSE reader and every event handler (`candidate`, `sentence`, `done`, `error`) check the turn generation and drop stale events.
- `reader.cancel()` is called when a generation change is detected inside the read loop, releasing the stream promptly.

**Backend (`adaptive-interview-api/src/routes/voice.ts`)**
- `sendSseEvent()` writes each SSE event and then calls `res.flush?.()` so that buffering middleware (e.g., compression) pushes the event to the client immediately rather than batching events until the response ends.
- Existing `AbortController` / socket-close handling cleans up in-flight TTS when the client disconnects.

## PWA / Service Worker Architecture

The frontend is packaged as a Progressive Web App so Android and iOS users can install it on their home screen and launch it in a standalone window.

```
┌─────────────────────────────────────────────────────────────┐
│                   BROWSER / ANDROID / iOS                   │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │  manifest   │  │  service worker │  │  offline.html   │   │
│  │  .json      │  │  sw.js          │  │                 │   │
│  └──────┬──────┘  └────────┬────────┘  └─────────────────┘   │
│         │                   │                                │
│         ▼                   ▼                                │
│  App metadata +       Precache shell,                        │
│  launcher icons       network-first for API/audio            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Next.js frontend (pages + components)
                              │
                              ▼
              Express backend (adaptive-interview-api)
```

**Key points:**

- `public/manifest.json` declares `display: standalone`, icons, theme colors, and start URL. Chrome on Android uses it for the install prompt.
- `public/sw.js` is registered by a small script in `src/app/layout.tsx`. It precaches the root shell, `offline.html`, and `manifest.json`, then uses a network-first strategy for API and audio requests. Immutable Next.js static chunks (`/_next/static/*`) are cached long-term.
- The service worker cache name includes a build id that `scripts/postbuild.mjs` stamps after each build. Old caches are deleted on activation, preventing stale shells across deployments.
- `public/offline.html` is served when the user launches the PWA without connectivity.
- PWA assets live in `public/` and are copied into `.next/standalone/public/` by `scripts/postbuild.mjs`.
- HTTPS is required in production for the install prompt; local development over `localhost` still allows service worker registration.

### iOS-specific PWA behavior

iOS Safari does not use `manifest.json` for standalone launch. Instead it relies on `src/app/layout.tsx` metadata:

| Meta tag / asset | Purpose |
|---|---|
| `apple-mobile-web-app-capable` | Enables Share → Add to Home Screen to launch in standalone mode |
| `apple-mobile-web-app-status-bar-style` | Controls status bar appearance (`black-translucent`) |
| `apple-mobile-web-app-title` | Home Screen icon label (`Interviews`) |
| `apple-touch-icon.png` | Home Screen icon (180×180) |
| `apple-touch-startup-image-*.png` | Branded launch splash screens for common iPhone/iPad sizes |
| `viewport-fit=cover` | Lets the app render edge-to-edge on notched devices |
| `env(safe-area-inset-top)` padding on the nav bar | Prevents the top navigation from hiding under the Dynamic Island/status bar |

iOS users install via **Safari Share → Add to Home Screen**. Standalone iOS Web Apps share the same service worker and offline fallback as Android, but microphone permission behavior for voice interviews must be validated on a real device.

## Important Conventions

- **Client components** explicitly declare `"use client"`; all data-fetching pages in this repo are Client Components
- **API calls from browser** use `apiFetch()` from `@/lib/api-client`, which injects `Authorization: Bearer` when `NEXT_PUBLIC_API_TOKEN` is set
- **Database queries** happen only in the backend; the frontend has no database connection
- **Backend business logic** uses Drizzle's type-safe query builder; raw SQL is used only for vector similarity queries
- **Error handling** uses custom `OllamaError` class with HTTP status codes in the backend
- **Environment config** in the frontend (`src/lib/config/`) is limited to frontend concerns; backend tuning lives in `adaptive-interview-api/src/lib/config/`
- **Next.js rewrites** proxy `/api/*` and `/audio/*` to the Express backend during development (`next.config.ts`). In production, a reverse proxy (nginx, Vercel, etc.) should do the same.
- **Backend architecture** is documented in [adaptive-interview-api/docs/ARCHITECTURE.md](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md)
