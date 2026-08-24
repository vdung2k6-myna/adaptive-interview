# Adaptive Interview Engine — First Slice

## Goal
Build the core adaptive interview loop: an AI interviewer that generates personalized questions in real time based on a candidate's claimed skills and a position's requirements, then adapts follow-ups based on the conversation history.

## Scope (In)
- Seed data model: `positions`, `candidates`, `interview_sessions`, `messages`
- Anonymous session tokens (UUID in URL) as auth
- Drizzle ORM for all database access
- Prompt pipeline: Ollama generates the first question and each follow-up using stored knowledge
- Minimal UI: a setup page to create sessions and an interview chat page
- Conversation state tracking (turn count, current context)
- Safety valve: max turns per session (e.g., 8)

## Non-goals (Out)
- Resume parsing or file uploads
- AI evaluation or scoring of answers
- Multi-stage pipeline (screening → technical → system design); single continuous chat only
- Admin dashboard or recruiter view beyond session creation
- Vector search / embeddings / RAG (schema reserves room for this later)
- Real-time streaming (synchronous request/response is fine)
- Voice, video, or code-editor stages
- Email invitations or magic links

## Success Criteria
1. A recruiter can create a session linking a candidate and a position.
2. A candidate can open the session URL and receive a personalized opening question.
3. After each answer, the candidate receives a context-aware follow-up.
4. The conversation stops after max turns or a "done" signal.
5. All messages are persisted in Postgres.
