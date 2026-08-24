# Architecture

## System Overview

The Adaptive Interview Engine follows a **separated frontend/backend architecture** (Pattern B). The Next.js frontend handles presentation and delegates all API calls to a standalone Express backend.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     FRONTEND (Next.js)                      â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  Pages   â”‚  â”‚ Componentsâ”‚  â”‚  Hooks   â”‚  â”‚  Styles  â”‚   â”‚
â”‚  â”‚(React)   â”‚  â”‚(React)   â”‚  â”‚(useState)â”‚  â”‚(Tailwind)â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚             â”‚             â”‚             â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â”‚
              fetch() / apiFetch()
                          â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚           Next.js Rewrites (dev proxy)                        â”‚
â”‚              /api/*  â†’  http://localhost:4000/api/*            â”‚
â”‚              /audio/* â†’ http://localhost:4000/audio/*           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     BACKEND (Express)                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ /api/    â”‚  â”‚ /api/    â”‚  â”‚ /api/    â”‚  â”‚ /api/    â”‚   â”‚
â”‚  â”‚ sessions â”‚  â”‚ messages â”‚  â”‚positions â”‚  â”‚candidatesâ”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜   â”‚
â”‚       â”‚             â”‚             â”‚             â”‚          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”´â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”´â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”´â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”´â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ Route   â”‚   â”‚ Route   â”‚   â”‚ Route   â”‚   â”‚ Route   â”‚   â”‚
â”‚  â”‚Handlers â”‚   â”‚Handlers â”‚   â”‚Handlers â”‚   â”‚Handlers â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚             â”‚             â”‚             â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    BUSINESS LOGIC LAYER                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ prompts.tsâ”‚  â”‚ ollama.tsâ”‚  â”‚evaluationâ”‚  â”‚embeddingsâ”‚   â”‚
â”‚  â”‚(Prompt   â”‚  â”‚(Ollama   â”‚  â”‚  .ts     â”‚  â”‚  .ts     â”‚   â”‚
â”‚  â”‚ Builder) â”‚  â”‚ Client)  â”‚  â”‚(Scoring) â”‚  â”‚(Vectors) â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚             â”‚             â”‚             â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     DATA ACCESS LAYER                        â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                               â”‚
â”‚  â”‚   db.ts   â”‚  â”‚ schema.ts â”‚                               â”‚
â”‚  â”‚(Drizzle  â”‚  â”‚(Table    â”‚                               â”‚
â”‚  â”‚  Pool)   â”‚  â”‚Defs)    â”‚                               â”‚
â”‚  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚             â”‚
   â”Œâ”€â”€â”€â”€â”´â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”´â”€â”€â”€â”€â”
   â”‚PostgreSQLâ”‚   â”‚ pgvector â”‚
   â”‚(Tables)  â”‚   â”‚(Extensionâ”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Note:** All Next.js pages are pure frontend Client Components. Every data fetch goes through `apiFetch()` to the backend Express server. The monolith contains no database code, no Drizzle schema, and no business logic â€” only presentation components, a lightweight `src/lib/api-client.ts`, and type definitions in `src/lib/types.ts`.

## Backend Extraction (Pattern B)

The API layer has been extracted into a standalone Express server in `adaptive-interview-api/` (port 4000). The Next.js monolith retains the frontend presentation layer and delegates all API calls to the Express backend.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     FRONTEND (Next.js)                        â”‚
â”‚  Pages, Components, Hooks, Styles (port 3000)                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
                    fetch() / API routes
                               â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     BACKEND (Express)                         â”‚
â”‚  /api/candidates, /api/positions, /api/sessions,            â”‚
â”‚  /api/messages, /api/evaluations, /api/voice, /api/mcp       â”‚
â”‚  (port 4000)                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
                    Drizzle ORM + pgvector
                               â”‚
                    PostgreSQL (port 5432)
```

**Why:** Enables independent scaling of frontend and backend, simplifies deployment, and allows the backend to run as a long-lived service separate from the Next.js serverless runtime.

## Key Design Patterns

### 1. Turn-Based Session Model

Interviews are structured as turn-based sessions with a configurable maximum (default 8 turns). Each turn consists of:

1. **Interviewer question** â€” Generated by Ollama based on position requirements, candidate background, and conversation history
2. **Candidate answer** â€” Typed by the user in the chat UI (text mode) or recorded via microphone (voice mode)

The session automatically completes when `currentTurn >= maxTurns`.

Sessions have a `mode` field: `"text"` (default) or `"voice"`. Voice mode requires:
- **audio.cpp** (port 8080) for speech-to-text transcription
- **Audio Gateway** (port 8082) for text-to-speech synthesis, which routes to either **Kokoro** (port 8081) or **Piper** (port 8083) based on the session's `ttsProvider` field.

These services are part of the `adaptive-interview-api` backend repository; the frontend only communicates with the backend Express server.

### 2. Streaming Architecture

The interviewer response streams token-by-token using Ollama's `stream: true` mode:

```
Ollama â†’ NDJSON chunks â†’ Next.js ReadableStream â†’ Client EventSource/fetch reader
```

On the client, chunks are batched to React state updates every ~50ms to prevent excessive re-renders.

### 3. Vector-Based Topic Tracking

Position requirements are embedded (vectorized) when a position is created. During the interview, each message is also embedded. A cosine similarity query determines which requirements have been "covered" by the conversation.

This drives the adaptive questioning â€” the prompt includes "Topics already covered" and "Remaining topics to explore" sections.

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
    â”‚
    â–¼
POST /api/sessions â”€â”€â†’ Express backend creates session row (status: "created")
    â”‚
    â–¼
Redirect to /interview/{id}
    â”‚
    â–¼
GET /api/sessions/{id} â”€â”€â†’ Backend loads session + candidate + position
    â”‚
    â–¼
If messages.length === 0:
    POST /api/messages (no content) â”€â”€â†’ Backend triggers first question
        â”‚
        â–¼
    buildPrompt() â”€â”€â†’ Assemble Ollama context (backend)
        â”‚
        â–¼
    generateChatResponseStream() â”€â”€â†’ Backend calls Ollama /api/chat (stream: true)
        â”‚
        â–¼
    Return text/plain stream â”€â”€â†’ Client receives NDJSON chunks
        â”‚
        â–¼
    Client batches updates every 50ms â”€â”€â†’ Render with MarkdownRenderer
        â”‚
        â–¼
    Stream completes â”€â”€â†’ Backend persists full message to DB
        â”‚
    currentTurn increments
    â”‚
User types answer â”€â”€â†’ POST /api/messages (with content)
    â”‚
    â–¼
    (Same pipeline generates next question)
    â”‚
After maxTurns:
    Session status â†’ "completed"
    Evaluation becomes available
```

## File Organization

### Frontend (This Repository)

```
src/
â”œâ”€â”€ app/                          # Next.js App Router (pages)
â”‚   â”œâ”€â”€ candidates/               # Candidate list page (Client Component, apiFetch)
â”‚   â”œâ”€â”€ candidates/new/           # Candidate creation form (Client Component)
â”‚   â”œâ”€â”€ candidates/[id]/edit/     # Candidate edit form (Client Component)
â”‚   â”œâ”€â”€ compare/                  # Side-by-side candidate comparison (Client Component)
â”‚   â”œâ”€â”€ dashboard/                # Recruiter dashboard (Client Component, apiFetch)
â”‚   â”œâ”€â”€ interview/[id]/           # Live interview chat (Client Component, apiFetch)
â”‚   â”‚   â”œâ”€â”€ voice/                # Voice interview page (Client Component, apiFetch)
â”‚   â”‚   â””â”€â”€ transcript/           # Post-interview review (Client Component, apiFetch)
â”‚   â”œâ”€â”€ positions/                # Position list page (Client Component, apiFetch)
â”‚   â”œâ”€â”€ positions/new/            # Position creation form (Client Component)
â”‚   â”œâ”€â”€ positions/[id]/edit/      # Position edit form (Client Component)
â”‚   â”œâ”€â”€ campaigns/                # Campaign list page (Client Component, apiFetch)
â”‚   â”œâ”€â”€ campaigns/new/            # Campaign creation form (Client Component)
â”‚   â”œâ”€â”€ campaigns/[id]/           # Campaign detail + report (Client Component, apiFetch)
â”‚   â”œâ”€â”€ setup/                    # Interview setup (Client Component, apiFetch)
â”‚   â”œâ”€â”€ error.tsx                 # Global error boundary
â”‚   â”œâ”€â”€ globals.css               # Global styles + Markdown theme
â”‚   â”œâ”€â”€ layout.tsx                # Root layout with nav + fonts
â”‚   â””â”€â”€ page.tsx                  # Landing â†’ redirect to dashboard
â”œâ”€â”€ components/                   # Shared React components
â”‚   â”œâ”€â”€ DeleteButton.tsx          # Client delete button with confirmation
â”‚   â”œâ”€â”€ MarkdownRenderer.tsx      # Rich Markdown rendering with syntax highlighting
â”‚   â”œâ”€â”€ AudioPlayer.tsx           # HTML5 audio playback
â”‚   â”œâ”€â”€ AudioRecorder.tsx         # Microphone capture + waveform
â”‚   â”œâ”€â”€ StreamingAudioQueue.tsx   # Sentence-level audio queue
â”‚   â”œâ”€â”€ ScoreInput.tsx            # Star score input
â”‚   â”œâ”€â”€ ModelBadge.tsx            # Model name badge
â”‚   â””â”€â”€ VersionHistory.tsx        # Evaluation version list
â””â”€â”€ lib/                          # Frontend utilities only
    â”œâ”€â”€ api-client.ts             # Browser fetch wrapper with Bearer token injection
    â”œâ”€â”€ config/                   # Frontend environment-specific config
    â”‚   â”œâ”€â”€ index.ts                # Active config export
    â”‚   â”œâ”€â”€ development.ts          # Dev settings
    â”‚   â””â”€â”€ production.ts           # Production settings
    â”œâ”€â”€ types.ts                  # Lightweight TypeScript interfaces
    â”œâ”€â”€ use-playback-rate.ts      # Persistent AI voice playback-rate hook
    â””â”€â”€ audio/                    # Client-side audio queue only
        â””â”€â”€ sentence-queue.ts       # Sequential audio playback with punctuation pauses
```

### Backend (`adaptive-interview-api`)

The backend repository contains:

- **Express server** (`server.ts` / `app.ts`) â€” port 4000
- **API route handlers** â€” all CRUD, streaming, voice, evaluations, MCP
- **Drizzle ORM** â€” same schema, separate `db.ts` connection
- **Business logic** â€” `prompts.ts`, `ollama.ts`, `evaluation.ts`, `embeddings.ts`
- **MCP analytics server** â€” SSE transport, tool registry, anonymization
- **Voice pipeline** â€” multer multipart, STT/TTS orchestration, SSE streaming
- **Audio services** â€” Audio Gateway, Kokoro, Piper, startup scripts
- **Authentication** â€” Bearer token validation middleware

## MCP Analytics Server Architecture

> **Location:** The MCP server lives in the `adaptive-interview-api` backend repository. The frontend does not expose `/api/mcp`.

A read-only MCP server exposes anonymized interview data to external AI clients via SSE over HTTP.

```
External AI Client (Claude Desktop / Inspector)
         â”‚
         â”‚ HTTP GET /api/mcp (SSE upgrade)
         â”‚ Headers: Authorization: Bearer <token>
         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Express Route Handler â€” adaptive-interview-api          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  MCP Server (McpServer + ExpressSseTransport)     â”‚   â”‚
â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚   â”‚
â”‚  â”‚  â”‚  Tool Registry                             â”‚   â”‚   â”‚
â”‚  â”‚  â”‚  - listCampaigns                           â”‚   â”‚   â”‚
â”‚  â”‚  â”‚  - getCampaignAnalytics                    â”‚   â”‚   â”‚
â”‚  â”‚  â”‚  - listSessions                            â”‚   â”‚   â”‚
â”‚  â”‚  â”‚  - getSessionSummary                       â”‚   â”‚   â”‚
â”‚  â”‚  â”‚  - listPositions                           â”‚   â”‚   â”‚
â”‚  â”‚  â”‚  - searchCandidatesBySkill                 â”‚   â”‚   â”‚
â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                         â”‚                              â”‚
â”‚                         â–¼                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  Anonymized Query Layer                         â”‚   â”‚
â”‚  â”‚  (Drizzle ORM queries + PII stripping)           â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
                              â–¼
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

Fully sequential â€” candidate waits for STT â†’ LLM â†’ TTS before hearing audio (~16â€“20s).

```
Candidate Browser
    â”‚
    â–¼
AudioRecorder (MediaRecorder API) â†’ audio/webm Blob
    â”‚
    â–¼
POST /api/voice/turn (multipart: sessionId + audio)
    â”‚
    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Express Backend                                         â”‚
â”‚  1. Save blob â†’ /tmp/audio/{sessionId}/                  â”‚
â”‚  2. STT: POST audio.cpp /v1/audio/transcriptions        â”‚
â”‚  3. Store candidate message (content = transcription)    â”‚
â”‚  4. Build prompt â†’ call Ollama (non-streaming)           â”‚
â”‚  5. TTS: POST Audio Gateway /v1/audio/speech              â”‚
â”‚     { text, engine: session.ttsProvider }               â”‚
â”‚  6. Save response audio                                  â”‚
â”‚  7. Store interviewer message (content + audioUrl)       â”‚
â”‚  8. Return JSON { candidateMessage, interviewerMessage } â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
    â”‚
    â–¼
AudioGateway â†’ routes to Kokoro (:8081) or Piper (:8083)
    â”‚
    â–¼
AudioPlayer â†’ HTML5 <audio> playback
```

### Streaming Turn (`POST /api/voice/stream`)

Sentence-level incremental TTS with SSE. The candidate hears the first sentence within ~5â€“6s because TTS fires **as soon as a sentence boundary is detected in the LLM token stream** â€” not after the full response is complete.

```
Candidate Browser
    â”‚
    â–¼
AudioRecorder â†’ audio/webm Blob
    â”‚
    â–¼
POST /api/voice/stream (SSE)
    â”‚
    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Express Backend                                         â”‚
â”‚  1. Save blob â†’ STT â†’ store candidate message          â”‚
â”‚     emit SSE: event=candidate                            â”‚
â”‚                                                          â”‚
â”‚  2. WHILE streaming LLM tokens:                        â”‚
â”‚       accumulatedText += token                         â”‚
â”‚       if sentence delimiter detected (.!?â€¦ã€‚ï¼Ÿï¼):      â”‚
â”‚         extract sentence â†’ fire TTS in background       â”‚
â”‚         (don't await â€” keep reading tokens)            â”‚
â”‚                                                          â”‚
â”‚  3. After LLM done: flush remaining text as final sentenceâ”‚
â”‚     await TTS results in order â†’ emit SSE: event=sentenceâ”‚
â”‚     (events emitted sequentially: index 0, 1, 2...)     â”‚
â”‚                                                          â”‚
â”‚  4. Concatenate all sentence WAVs â†’ store full message  â”‚
â”‚     emit SSE: event=done                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
    â”‚
    â–¼
StreamingAudioQueue â†’ plays chunks sequentially, preloads next
```

**Why this is faster:**
- Standard: `STT(3s) + LLM(8s) + TTS(5s) = ~16s` before audio plays
- Streaming (batch): `STT(3s) + LLM(8s) + parallel TTS(2s) = ~13s`, first audio at ~11s
- Streaming (incremental): `STT(3s) + first sentence complete(~4s) + TTS(1s) = ~8s`, first audio at ~5â€“6s

**Text Preprocessing Pipeline (backend):**
Before any TTS call, text passes through the backend's text-processing module:
- `stripMarkdown()` â€” removes formatting (bold, italic, headers, code blocks, inline code, lists, blockquotes) so TTS engines don't speak asterisks or backticks
- `splitForTTS(text, maxChars=60)` â€” splits long sentences into phoneme-safe chunks. Prefers strong boundaries (`:` > `;` > `,` > `space`) to keep clauses intact
- `synthesizeSpeechWithFallback()` â€” recursive retry: if a chunk exceeds the engine's phoneme limit (~510), it is split in half and retried. For WAV outputs (Piper), successful halves are concatenated so no audio is lost

**Key differences from text mode:**
- Sentence boundaries detected incrementally during LLM streaming, not after full response
- TTS calls run in background during LLM generation; results awaited in order after LLM completes
- Audio files stored on local filesystem (`/tmp/audio/{sessionId}/`) by the backend
- Messages table has audio metadata columns (`audioUrl`, `audioFormat`, `audioDurationSeconds`, `sttConfidence`)
- First question uses dedicated `POST /api/voice/start` endpoint

## Important Conventions

- **Client components** explicitly declare `"use client"`; all data-fetching pages in this repo are Client Components
- **API calls from browser** use `apiFetch()` from `@/lib/api-client`, which injects `Authorization: Bearer` when `NEXT_PUBLIC_API_TOKEN` is set
- **Database queries** happen only in the backend; the frontend has no database connection
- **Backend business logic** uses Drizzle's type-safe query builder; raw SQL is used only for vector similarity queries
- **Error handling** uses custom `OllamaError` class with HTTP status codes in the backend
- **Environment config** in the frontend (`src/lib/config/`) is limited to frontend concerns; backend tuning lives in `adaptive-interview-api/src/lib/config/`
- **Next.js rewrites** proxy `/api/*` and `/audio/*` to the Express backend during development (`next.config.ts`). In production, a reverse proxy (nginx, Vercel, etc.) should do the same.
- **Backend architecture** is documented in [adaptive-interview-api/docs/ARCHITECTURE.md](https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/docs/ARCHITECTURE.md)
