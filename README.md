# Adaptive Interview Engine

An AI-powered technical interview platform that generates personalized, context-aware interview questions in real time, evaluates candidates with structured AI scoring, and provides a recruiter dashboard for review and calibration. Built with Next.js, Drizzle ORM, PostgreSQL, pgvector, and Ollama.

## Features

- **Adaptive AI Interviewer** — Each question is generated on-the-fly based on the candidate's skills, experience, CV, and the position's requirements
- **CV-Aware Prompting** — Paste a candidate's full resume; the AI uses it to ask deeply relevant questions
- **Job Description Context** — Attach a free-form job description to any position; the AI uses it for richer question generation and evaluation
- **Real-Time Streaming** — Interviewer responses stream token-by-token using Ollama's `stream: true`; no more staring at a loading spinner
- **Rich Markdown Rendering** — Interviewer messages render Markdown (bold, lists, code blocks) with syntax highlighting via `highlight.js` and safe HTML via `DOMPurify`
- **Semantic Topic Tracking** — Vector embeddings (pgvector) track which position requirements have been covered, preventing repeated or skipped topics
- **Turn-Based Sessions** — Configurable max turns per interview (default: 8). Auto-completes when the limit is reached
- **AI Evaluation** — Post-interview structured scoring across 4 dimensions (technical depth, communication clarity, problem solving, relevance to role) with strengths, weaknesses, and a hire recommendation
- **Human Calibration** — Recruiters can override AI scores, adjust recommendations, and leave notes. All versions are preserved for audit history
- **Recruiter Dashboard** — Centralized view of all sessions with status filters, search, stats cards, and color-coded recommendation badges
- **Side-by-Side Comparison** — Compare two candidates' evaluations on a single page using `/compare?a={id}&b={id}`
- **Recruiting Campaigns** — Group positions into hiring campaigns with dates, tags, and status. View aggregated metrics (sessions, completion rate, scores, recommendations, top candidates) per campaign
- **Position & Candidate Management** — Create, edit, and delete positions and candidates. Edit/delete is restricted to unused entries to preserve interview history
- **Anonymous Session Links** — Share an interview via a unique UUID URL — no login required. Copy the link directly from the dashboard or transcript page
- **Persistent History** — All messages, embeddings, and evaluations stored in PostgreSQL via Drizzle ORM

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL + pgvector extension |
| ORM | Drizzle ORM |
| AI Backend | Ollama (local or remote) |
| Embedding Model | `mxbai-embed-large` (or compatible) |
| Markdown | `marked` + `highlight.js` + `DOMPurify` |
| Fonts | Geist (Sans + Mono) |

## Architecture

```
src/
├── app/
│   ├── page.tsx                          # Redirects to /dashboard
│   ├── layout.tsx                        # Root layout with nav bar + Geist fonts
│   ├── globals.css                       # Tailwind + Markdown + syntax highlight styles
│   ├── error.tsx                         # Global error boundary
│   ├── api/
│   │   ├── candidates/route.ts           # POST /api/candidates
│   │   ├── candidates/[id]/route.ts      # GET / PATCH / DELETE /api/candidates/:id
│   │   ├── evaluations/[sessionId]/route.ts   # GET / PATCH /api/evaluations/:sessionId
│   │   ├── evaluations/versions/[versionId]/route.ts  # GET / DELETE /api/evaluations/versions/:versionId
│   │   ├── messages/route.ts             # POST /api/messages (streaming)
│   │   ├── positions/route.ts            # POST /api/positions
│   │   ├── positions/[id]/route.ts       # GET / PATCH / DELETE /api/positions/:id
│   │   ├── campaigns/route.ts            # POST / GET /api/campaigns
│   │   ├── campaigns/[id]/route.ts       # GET / PATCH / DELETE /api/campaigns/:id
│   │   ├── campaigns/[id]/positions/route.ts  # POST / DELETE /api/campaigns/:id/positions
│   │   └── sessions/
│   │       ├── route.ts                  # GET / POST /api/sessions
│   │       └── [id]/
│   │           ├── route.ts              # GET /api/sessions/:id
│   │           └── evaluate/route.ts     # POST /api/sessions/:id/evaluate
│   ├── candidates/
│   │   ├── page.tsx                      # Candidate list (with edit/delete)
│   │   ├── new/page.tsx                  # Candidate creation form
│   │   └── [id]/edit/page.tsx            # Candidate edit form
│   ├── compare/
│   │   └── page.tsx                      # Side-by-side comparison (client)
│   ├── dashboard/
│   │   └── page.tsx                      # Recruiter dashboard (client)
│   ├── interview/[id]/
│   │   ├── page.tsx                      # Live interview chat (client)
│   │   └── transcript/
│   │       └── page.tsx                  # Post-interview transcript + evaluation (client)
│   ├── positions/
│   │   ├── page.tsx                      # Position list (with edit/delete)
│   │   ├── new/page.tsx                  # Position creation form
│   │   └── [id]/edit/page.tsx            # Position edit form
│   ├── campaigns/
│   │   ├── page.tsx                      # Campaign list
│   │   ├── new/page.tsx                  # Campaign creation form
│   │   └── [id]/page.tsx                # Campaign detail + report
│   └── setup/
│       └── page.tsx                      # Interview setup (select position + candidate)
├── components/
│   ├── DeleteButton.tsx                  # Client delete button with confirmation
│   ├── MarkdownRenderer.tsx              # Rich Markdown with syntax highlighting
│   ├── MessageBubble.tsx                 # Memoized chat message bubble
│   ├── ModelBadge.tsx                    # Model name badge
│   ├── ScoreInput.tsx                    # Interactive star score input
│   └── VersionHistory.tsx                # Evaluation version list
└── lib/
    ├── config/                           # Environment-specific configuration
    │   ├── index.ts                      # Active config export
    │   ├── development.ts                # Dev settings (small pools, short timeouts)
    │   └── production.ts                 # Prod settings (large pools, long timeouts)
    ├── db.ts                             # Drizzle + node-postgres pool
    ├── schema.ts                         # Drizzle table definitions
    ├── seed.ts                           # Seed script (1 position + 1 candidate)
    ├── prompts.ts                        # buildPrompt(): assembles Ollama context
    ├── ollama.ts                         # Ollama /api/chat client (blocking + streaming)
    ├── evaluation.ts                     # Post-interview AI evaluation pipeline
    ├── embeddings.ts                     # Vector storage and similarity queries
    └── errors.ts                         # Custom error classes
```

## Database Schema

| Table | Columns |
|---|---|
| **positions** | `id`, `title`, `level`, `jobDescription` (text, nullable), `requirements` (text[]), `createdAt` |
| **candidates** | `id`, `name`, `email`, `skills` (text[]), `experienceYears`, `cv` (text), `createdAt` |
| **interviewSessions** | `id`, `positionId` (FK), `candidateId` (FK), `status`, `maxTurns`, `currentTurn`, `completedAt`, `createdAt` |
| **messages** | `id`, `sessionId` (FK), `role` (interviewer \| candidate), `content`, `createdAt` |
| **embeddings** | `id`, `sourceType` (requirement \| message), `sourceId`, `sessionId` (nullable), `content`, `embedding` (JSON string of float array), `createdAt` |
| **evaluations** | `id`, `sessionId` (FK), `model`, `rawResponse`, `technicalDepth`, `communicationClarity`, `problemSolving`, `relevanceToRole`, `strengths` (text[]), `weaknesses` (text[]), `recommendation`, `confidence`, `recruiterNotes`, `createdAt` |
| **evaluationVersions** | `id`, `sessionId` (FK), `model`, `rawResponse`, `aiTechnicalDepth`, `aiCommunicationClarity`, `aiProblemSolving`, `aiRelevanceToRole`, `humanTechnicalDepth`, `humanCommunicationClarity`, `humanProblemSolving`, `humanRelevanceToRole`, `aiRecommendation`, `humanRecommendation`, `confidence`, `strengths` (text[]), `weaknesses` (text[]), `recruiterNotes`, `humanCalibrated`, `createdAt` |
| **campaigns** | `id`, `name`, `description`, `startDate`, `endDate`, `tags` (text[]), `status`, `createdAt` |
| **campaignPositions** | `campaignId` (FK), `positionId` (FK), `addedAt` |

## API Routes

### Sessions & Messages

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/sessions` | Create a session: `{ positionId, candidateId }` |
| `GET` | `/api/sessions` | List sessions with filters, pagination, and evaluation summary |
| `GET` | `/api/sessions/:id` | Fetch session + candidate + position + messages |
| `POST` | `/api/messages` | Submit answer or trigger first question. Returns `ReadableStream` |
| `POST` | `/api/sessions/:id/evaluate` | Generate a new AI evaluation version for a completed session |

### Evaluations

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/evaluations/:sessionId` | Get latest evaluation and version history |
| `GET` | `/api/evaluations/versions/:versionId` | Get a specific evaluation version |
| `PATCH` | `/api/evaluations/:sessionId` | Update human calibration scores / notes on latest version |
| `DELETE` | `/api/evaluations/versions/:versionId` | Delete a non-latest evaluation version |

### Positions

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/positions` | Create a position: `{ title, level, requirements[], jobDescription? }` |
| `GET` | `/api/positions/:id` | Fetch a single position |
| `PATCH` | `/api/positions/:id` | Update position fields (regenerates embeddings if requirements changed). Returns 409 if referenced by sessions |
| `DELETE` | `/api/positions/:id` | Delete if unused. Returns 409 if referenced by sessions |

### Candidates

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/candidates` | Create a candidate: `{ name, email, skills[], experienceYears?, cv? }` |
| `GET` | `/api/candidates/:id` | Fetch a single candidate |
| `PATCH` | `/api/candidates/:id` | Update candidate fields. Returns 409 if referenced by sessions |
| `DELETE` | `/api/candidates/:id` | Delete if unused. Returns 409 if referenced by sessions |

### Campaigns

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/campaigns` | Create a campaign: `{ name, description?, startDate?, endDate?, tags?, status?, positionIds? }` |
| `GET` | `/api/campaigns` | List campaigns with `positionCount` and `sessionCount` |
| `GET` | `/api/campaigns/:id` | Fetch campaign with positions and full report |
| `PATCH` | `/api/campaigns/:id` | Update campaign fields |
| `DELETE` | `/api/campaigns/:id` | Delete campaign (cascades junction rows) |
| `POST` | `/api/campaigns/:id/positions` | Add a position to a campaign |
| `DELETE` | `/api/campaigns/:id/positions?positionId=...` | Remove a position from a campaign |

## Prompt Pipeline

The `buildPrompt()` function in `src/lib/prompts.ts` constructs the Ollama context:

1. **Position context** — title, level, requirements, and job description (when present)
2. **Candidate context** — name, skills, experience years, **CV summary** (first 800 chars)
3. **Topics covered** — semantic embedding similarity from past messages
4. **Remaining topics** — requirements not yet covered
5. **Instruction** — "Generate the next interview question. One concise question only, no preamble. Use Markdown formatting with code blocks where helpful."

Messages are sent with `role: "user"` for the context + candidate answers, and `role: "assistant"` for past interviewer questions, ensuring compatibility with all Ollama models.

## Streaming Architecture

```
Ollama → NDJSON chunks → Next.js ReadableStream → Client fetch reader
                ↓
    Server accumulates fullText in a ref
                ↓
    Stream ends → persist full message to DB
```

On the client, chunks are batched to React state updates every ~50ms to prevent excessive re-renders (~20/sec target).

## Environment Variables

Create a `.env.local` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_interview

# Ollama
OLLAMA_BASE_URL=http://localhost:11434    # change to your remote endpoint if using one
OLLAMA_MODEL=llama3.1                     # or llama3, qwen2.5-coder, etc.
OLLAMA_EMBED_MODEL=mxbai-embed-large        # for semantic topic tracking

# Optional
EMBEDDING_SIMILARITY_THRESHOLD=0.75         # default: 0.75

# Supabase (existing, optional)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

> **Note:** Some cloud/proxy Ollama models do not accept `system` role messages. This app sends the interviewer context as a `user` message to ensure compatibility.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure database

Ensure PostgreSQL is running, the database exists, and the pgvector extension is enabled:

```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Apply migrations:

```bash
psql $DATABASE_URL -f migrations/0000_initial.sql
psql $DATABASE_URL -f migrations/0001_add_cv.sql
psql $DATABASE_URL -f migrations/0000_add_embeddings_table.sql
psql $DATABASE_URL -f migrations/0001_redundant_night_thrasher.sql
psql $DATABASE_URL -f migrations/0004_add_evaluation_versions.sql
psql $DATABASE_URL -f migrations/0004_aromatic_orphan.sql
psql $DATABASE_URL -f migrations/0005_migrate_evaluations.sql
psql $DATABASE_URL -f migrations/0005_salty_loners.sql
```

Or use Drizzle Kit:

```bash
npx drizzle-kit migrate
```

### 3. Seed sample data

```bash
npx tsx src/lib/seed.ts
```

This creates:
- **Position:** Senior Full Stack Engineer (React, Node.js, PostgreSQL, TypeScript, System Design)
- **Candidate:** Jane Doe (React, Node.js, Python, AWS, 5 years, with CV)

### 4. Start dev server

```bash
npm run dev
```

Open `http://localhost:3000` (redirects to `/dashboard`)

## Usage Flow

### For Recruiters

1. **Dashboard** (`/dashboard`) — view all sessions, filter by status, search by candidate name, click into any transcript, copy interview links
2. **Transcript** (`/interview/{id}/transcript`) — review Q/A pairs, view AI evaluation scores, override with human scores, add notes, browse version history, copy interview link
3. **Compare** (`/compare?a={id}&b={id}`) — side-by-side table of two candidates' scores and recommendations
4. **Setup** (`/setup`) — create a new interview by selecting a position + candidate, or create new ones inline
5. **Positions** (`/positions`) — view all positions, edit descriptions/requirements, delete unused positions
6. **Candidates** (`/candidates`) — view all candidates, edit details/CV, delete unused candidates
7. **Campaigns** (`/campaigns`) — view all hiring campaigns. Create a campaign, assign positions, and view aggregated metrics (sessions, completion rate, scores, recommendations, top candidates)

### For Candidates

1. **Landing page** (`/`) → redirects to Dashboard
2. **Setup** (`/setup`) → select a position + candidate from the dropdowns, or create new ones
3. **Interview** (`/interview/{id}`) → AI generates the first question immediately (streamed in real time)
4. **Candidate answers** → types a response, AI generates the next context-aware follow-up
5. **Completion** → after max turns (default 8), the interview ends with a thank-you message and evaluation becomes available

### Creating Positions & Candidates

- **`/positions/new`** — enter title, select level, add requirement tags (press Enter), optionally add a job description
- **`/candidates/new`** — enter name/email/experience, add skill tags, paste full CV in the textarea

Both forms redirect back to `/setup` on success, where the new entries immediately appear in the dropdowns. Existing positions and candidates can be edited or deleted from their respective list pages (`/positions`, `/candidates`) as long as they are not referenced by any interview sessions.

### Creating Campaigns

- **`/campaigns/new`** — enter campaign name, optional description, dates, tags, status, and select positions to include
- **`/campaigns/{id}`** — view campaign details, metrics cards, recommendation distribution, top candidates table, and associated positions

## Ollama Model Notes

| Model | Compatibility | Notes |
|---|---|---|
| `llama3.1` | ✅ Local / Remote | Fast, capable, good default |
| `llama3:8b` | ✅ Local | Fast, loads instantly |
| `qwen2.5-coder:latest` | ✅ Local | Strong reasoning, good for technical interviews |
| `mxbai-embed-large` | ✅ Local | Embedding model for semantic topic tracking |

If your model returns empty content with `done_reason: "load"`, the app retries automatically. For consistently instant responses, prefer local models.

## Scripts

```bash
npm run dev        # Start dev server (port 3000)
npm run dev:3001   # Start dev server on port 3001
npm run dev:4000   # Start dev server on port 4000
npm run build      # Production build
npm run postbuild  # Copy static chunks into standalone output (runs automatically after build)
npm start          # Start production server (standalone)
npm run lint       # ESLint check
```

> **Note:** With `output: "standalone"`, `npm start` runs `node .next/standalone/server.js`. The standalone output is a self-contained bundle that does not require the full `node_modules`. A `postbuild` script copies `.next/static` into the standalone directory so chunk loading works correctly.

## License

MIT
