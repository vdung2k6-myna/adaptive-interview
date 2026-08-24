# Adaptive Interview Engine — Tasks

- [x] **Task 1:** Set up Drizzle ORM and Database Schema
  - Install `drizzle-orm`, `drizzle-kit`, and `pg` driver
  - Create `src/lib/db.ts` with connection pool
  - Create `src/lib/schema.ts` with positions, candidates, interviewSessions, messages tables
  - Configure `drizzle.config.ts`
  - Run initial migration to create tables in local Postgres
  - Seed one position and one candidate for testing

- [x] **Task 2:** Build Ollama Client and Prompt Builder
  - Create `src/lib/ollama.ts`: POST to Ollama `/api/generate` or `/api/chat`
  - Create `src/lib/prompts.ts`: `buildPrompt(session, messages)` function
  - Test prompt builder standalone: verify it produces coherent questions from seed data
  - Handle Ollama errors (model not loaded, timeout) gracefully

- [x] **Task 3:** Create API Routes for Session and Messages
  - `POST /api/sessions`: accepts `{ positionId, candidateId }`, returns session
  - `GET /api/sessions/[id]`: returns session + candidate + position + messages array
  - `POST /api/messages`: accepts `{ sessionId, content }`, stores candidate answer, generates next question via Ollama, stores interviewer question, returns it
  - Implement turn counting and max-turns enforcement
  - Implement status transitions (`created` → `in_progress` → `completed`)

- [x] **Task 4:** Build Setup Page
  - Route: `/setup`
  - Form to create interview session: dropdown/select for position + candidate (from seed data)
  - On submit: call `POST /api/sessions`, then redirect to `/interview/{id}`
  - Show the generated interview link (copyable)

- [x] **Task 5:** Build Interview Chat Page
  - Route: `/interview/[id]`
  - Fetch session data on load (SSR or client-side)
  - If no messages: trigger first question generation (or render it from GET response)
  - Render message history (interviewer on left, candidate on right)
  - Input field + submit button for candidate answers
  - Loading state while waiting for Ollama response
  - Handle "interview complete" state (disable input, show thank-you)

- [x] **Task 6:** Polish and End-to-End Testing
  - Verify full flow: setup → first question → answer → follow-up → max turns → complete
  - Add basic error handling UI (Ollama down, DB unreachable)
  - Ensure responsive layout with Tailwind
  - Clean up default `page.tsx` content

## Future (Out of Scope)
- Admin dashboard for recruiters
- AI evaluation and scoring
- Multi-stage pipeline (screening → technical → system design)
- Resume parsing and file uploads
- Vector search with pgvector
- Email invitations / magic links
- Real-time streaming of responses
