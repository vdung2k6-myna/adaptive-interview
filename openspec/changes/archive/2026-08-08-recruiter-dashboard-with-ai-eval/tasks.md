# Recruiter Dashboard with AI Evaluation — Tasks

## 1. Database Schema

- [x] 1.1 Add `evaluations` table to `src/lib/schema.ts` with all evaluation fields
- [x] 1.2 Generate Drizzle migration with `drizzle-kit generate`
- [x] 1.3 Apply migration to local Postgres
- [x] 1.4 Add `completedAt` timestamp to `interview_sessions` table (or use latest message timestamp for duration calculation)

## 2. API Routes

- [x] 2.1 Create `GET /api/sessions` with optional `status` and `positionId` query filters, ordered by `updatedAt` desc, paginated (default 20)
- [x] 2.2 Create `POST /api/sessions/[id]/evaluate` — triggers AI evaluation for a completed session
  - [x] 2.2.1 Fetch session messages from DB
  - [x] 2.2.2 Build evaluation prompt with transcript and position requirements
  - [x] 2.2.3 Call Ollama with the prompt
  - [x] 2.2.4 Parse JSON response (extract JSON block, validate fields, handle errors)
  - [x] 2.2.5 Store evaluation in DB
  - [x] 2.2.6 Return evaluation JSON
- [x] 2.3 Create `GET /api/evaluations/[sessionId]` — returns stored evaluation or 404
- [x] 2.4 Create `PATCH /api/evaluations/[sessionId]` — updates `recruiter_notes`

## 3. AI Evaluation Service

- [x] 3.1 Create `src/lib/evaluation.ts` with `generateEvaluation(sessionId)` function
- [x] 3.2 Implement transcript formatting for the prompt (interviewer Q + candidate A pairs)
- [x] 3.3 Implement JSON extraction from Ollama response (handle markdown code blocks, extra text)
- [x] 3.4 Implement validation logic for parsed JSON (required fields, score ranges, recommendation enum)
- [x] 3.5 Implement retry logic (max 2 retries) with stricter prompt if parsing fails
- [x] 3.6 Handle Ollama errors (timeout, model unavailable) gracefully — store error state

## 4. Dashboard Page

- [x] 4.1 Create `/dashboard` page route
- [x] 4.2 Fetch sessions list from `GET /api/sessions`
- [x] 4.3 Build session table with columns: candidate name, position title, status, turns, actions
- [x] 4.4 Add status filter dropdown (All / Created / In Progress / Completed)
- [x] 4.5 Add position filter dropdown
- [x] 4.6 Add search/filter by candidate name
- [x] 4.7 Add stats summary cards (total, active, complete, avg score)
- [x] 4.8 Add navigation links to transcript pages

## 5. Transcript + Evaluation Page

- [x] 5.1 Create `/interview/[id]/transcript` page route
- [x] 5.2 Fetch session data and messages (reuse existing `GET /api/sessions/[id]`)
- [x] 5.3 Display transcript in a clean, readable format (Q/A pairs, not chat bubbles)
- [x] 5.4 Check for existing evaluation; if none, show "Generate Evaluation" button
- [x] 5.5 On button click, call `POST /api/sessions/[id]/evaluate` with loading state
- [x] 5.6 Display evaluation scores with star ratings
- [x] 5.7 Display strengths and weaknesses as bulleted lists
- [x] 5.8 Display recommendation badge (color-coded: green=yes, yellow=maybe, red=no)
- [x] 5.9 Display confidence percentage
- [x] 5.10 Add editable "Recruiter notes" textarea with save button (PATCH endpoint)

## 6. Comparison View

- [x] 6.1 Create `/compare` page or modal that accepts two session IDs as query params
- [x] 6.2 Fetch both sessions' transcripts and evaluations
- [x] 6.3 Display side-by-side comparison table with scores, coverage, and recommendations
- [x] 6.4 Add links to individual transcript pages

## 7. Navigation & Routing

- [x] 7.1 Update home page (`/`) to redirect to `/dashboard` or show dashboard directly
- [x] 7.2 Add dashboard link to app layout/header
- [x] 7.3 Add "Back to dashboard" links on transcript page

## 8. Error Handling & Edge Cases

- [x] 8.1 Handle evaluation for incomplete sessions (return 400 with clear message)
- [x] 8.2 Handle evaluation for non-existent session (404)
- [x] 8.3 Handle Ollama timeout during evaluation (store error, show retry button)
- [x] 8.4 Handle malformed evaluation JSON (display raw response, allow retry)
- [x] 8.5 Handle empty transcript (e.g., session created but no messages)

## 9. Manual Testing

- [x] 9.1 Test dashboard loads with multiple sessions
- [x] 9.2 Test evaluation generation for a completed interview
- [x] 9.3 Test transcript page displays correctly
- [x] 9.4 Test recruiter notes save and persist
- [x] 9.5 Test comparison view with two candidates
- [x] 9.6 Test filters on dashboard
