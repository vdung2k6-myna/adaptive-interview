# Adaptive Interview Engine — Design

## Database Schema (Drizzle ORM)

```typescript
// schema.ts
import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  level: text("level").notNull(),
  requirements: text("requirements").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  skills: text("skills").array().notNull(),
  experienceYears: integer("experience_years"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id").references(() => positions.id).notNull(),
  candidateId: uuid("candidate_id").references(() => candidates.id).notNull(),
  status: text("status").notNull().default("created"), // created | in_progress | completed
  maxTurns: integer("max_turns").notNull().default(8),
  currentTurn: integer("current_turn").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => interviewSessions.id).notNull(),
  role: text("role").notNull(), // interviewer | candidate
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Vector readiness:** `pgvector` will be added later via a migration. `knowledge_chunks` table is deferred.

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/sessions` | Create a new interview session (setup page calls this) |
| GET | `/api/sessions/:id` | Fetch session + candidate + position + messages |
| POST | `/api/messages` | Submit candidate answer, trigger next question generation |
| POST | `/api/questions` | Internal: generate next question via Ollama (can also be inlined) |

**Auth:** No middleware for MVP. The session UUID is the bearer token. Access control is implicit: UUIDs are unguessable.

## Prompt Pipeline

### Prompt Builder (`src/lib/prompts.ts`)

A single parameterized function `buildPrompt(session, messages)`:

1. Fetch `position.requirements` and `candidate.skills`.
2. Extract `topicsCovered` from the conversation (naive: keyword matching on messages for now).
3. Build system context:
   - Interviewer persona
   - Candidate's claimed skills
   - Position requirements
   - Topics already covered
   - Remaining topics to explore
4. Append the full message history.
5. Append instruction: "Generate the next interview question. One question only, no preamble."

### Ollama Integration (`src/lib/ollama.ts`)

- Target: `http://localhost:11434/api/generate` (or `/api/chat` if using chat format).
- Model: whatever the user has pulled (e.g., `llama3.1`, `mistral`, `qwen2.5`).
- Temperature: `0.7` for interview questions (creative but focused).
- No streaming for this slice; wait for full response.

## State Flow

```
POST /api/sessions
  → Insert interview_sessions row (status: created)
  → Return session URL: /interview/{id}

GET /interview/{id}
  → If currentTurn === 0 && no messages:
      → POST internal question generation
      → Insert interviewer message
  → Render chat UI with all messages

POST /api/messages (candidate answer)
  → Insert candidate message
  → Increment currentTurn
  → If currentTurn >= maxTurns:
      → status = completed
      → Return "Thank you, the interview is complete."
  → Else:
      → Call prompt builder + Ollama
      → Insert interviewer message
      → Return new question
```

## UI Structure

```
src/app/
├── page.tsx              # Redirect to /setup or landing
├── layout.tsx            # Already exists (Geist fonts, dark mode ready)
├── globals.css           # Already exists
├── setup/
│   └── page.tsx          # Form: select position + candidate → create session
├── interview/
│   └── [id]/
│       └── page.tsx      # Chat UI: message list + input + submit
├── api/
│   ├── sessions/
│   │   └── route.ts      # POST /api/sessions
│   ├── sessions/[id]/
│   │   └── route.ts      # GET /api/sessions/:id
│   └── messages/
│       └── route.ts      # POST /api/messages

src/lib/
├── db.ts                 # Drizzle client singleton (uses DATABASE_URL env)
├── schema.ts             # Drizzle table definitions
├── prompts.ts            # Prompt builder
└── ollama.ts             # Ollama API client

migrations/
└── 0000_initial.sql      # Hand-written or drizzle-kit generated
```

## Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ollama_chat
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

## Key Design Decisions

1. **Synchronous question generation** — candidate waits 2–5s between turns. Streaming deferred.
2. **Anonymous session tokens** — UUID is the auth boundary. No login, no cookies.
3. **Single prompt builder** — one function ensures consistent system prompt across all turns.
4. **Topics tracked naively** — keyword extraction from messages, not NLP. Good enough for slice one.
5. **No evaluation** — Ollama only interviews, does not score. Scoring is a future change.
