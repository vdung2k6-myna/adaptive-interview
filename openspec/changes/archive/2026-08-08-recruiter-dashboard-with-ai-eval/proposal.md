# Recruiter Dashboard with AI Evaluation — Proposal

## Why

The current recruiter experience ends after generating an interview link. Once the candidate finishes, the recruiter has no way to see what happened — no transcript, no summary, no evaluation, no way to compare candidates. This creates a "black box" interview process where the AI conversation happens in isolation and all the data we collect (messages, embeddings, coverage) is invisible.

A recruiter needs visibility to make hiring decisions. Without it, this tool is an experiment, not a product.

## What Changes

Build a recruiter dashboard that:
1. Lists all interview sessions with status, candidate info, and basic stats
2. Provides a transcript view for completed interviews
3. Triggers an AI evaluation after interview completion
4. Displays evaluation results (scores, strengths, weaknesses, recommendation)
5. Allows side-by-side candidate comparison for a given position

## Scope

**In scope:**
- New `evaluations` table in the database
- New API routes: `GET /api/sessions` (list), `GET /api/sessions/[id]/evaluate` (trigger eval), `GET /api/evaluations/[sessionId]`
- New pages: `/dashboard` (session list), `/interview/[id]/transcript` (transcript + eval)
- AI evaluation prompt that sends the full transcript to Ollama and returns structured JSON
- Dashboard UI with status badges, coverage summary, and evaluation scores

**Out of scope:**
- PDF export (future feature)
- ATS integrations (future feature)
- Real-time "watch live" during in-progress interviews (future feature)
- Authentication / role-based access (assumed single-user for now)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI evaluation is biased or inconsistent | Store raw evaluation JSON, display confidence level, allow recruiter to override |
| Ollama evaluation is expensive/slow | Evaluate only once per session, cache result, use lightweight model |
| Structured JSON output is unreliable | Use strict prompt formatting with retry logic; fallback to plain text |
| Dashboard becomes cluttered with many sessions | Pagination, filtering by position/status |

## Success Criteria

- Recruiter can view a list of all interview sessions after visiting `/dashboard`
- Completed sessions show a "View transcript & evaluation" button
- Transcript page displays the full Q&A conversation
- Evaluation shows structured scores and a recommendation
- Comparison view shows 2+ candidates side-by-side for the same position
