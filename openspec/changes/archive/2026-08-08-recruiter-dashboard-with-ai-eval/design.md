# Recruiter Dashboard with AI Evaluation — Design

## Data Model Changes

### New table: `evaluations`

```sql
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  model TEXT NOT NULL,                    -- "kimi-k2.6:cloud" etc.
  raw_response TEXT NOT NULL,             -- full Ollama response (for audit/debug)
  overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 5),
  technical_depth INTEGER CHECK (technical_depth BETWEEN 1 AND 5),
  communication_clarity INTEGER CHECK (communication_clarity BETWEEN 1 AND 5),
  problem_solving INTEGER CHECK (problem_solving BETWEEN 1 AND 5),
  relevance_to_role INTEGER CHECK (relevance_to_role BETWEEN 1 AND 5),
  strengths TEXT[] NOT NULL DEFAULT '{}',
  weaknesses TEXT[] NOT NULL DEFAULT '{}',
  recommendation TEXT CHECK (recommendation IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  recruiter_notes TEXT,                   -- editable by recruiter
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Recruiter Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ /dashboard  │───▶│ /interview  │───▶│ /interview/[id]     │ │
│  │             │    │ /[id]/trans │    │ /transcript         │ │
│  └──────┬──────┘    └──────┬──────┘    └─────────────────────┘ │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  API Layer                                │  │
│  │  GET /api/sessions?status=&positionId=                   │  │
│  │  GET /api/sessions/[id]/evaluate  → triggers eval        │  │
│  │  GET /api/evaluations/[sessionId]                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Services                                 │  │
│  │  generateEvaluation(sessionId):                          │  │
│  │    1. Fetch messages from DB                             │  │
│  │    2. Build evaluation prompt                            │  │
│  │    3. Call Ollama with JSON mode or strict format        │  │
│  │    4. Parse response into structured fields              │  │
│  │    5. Store in evaluations table                         │  │
│  │    6. Return evaluation                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Evaluation Prompt Design

The prompt sends the full interview transcript and asks for structured JSON:

```
You are an experienced technical hiring manager reviewing an interview transcript.

Position: {title} ({level})
Requirements: {requirements}

Interview transcript:
{formatted_transcript}

Evaluate the candidate on these dimensions (1-5 scale):
- technical_depth: depth of technical knowledge demonstrated
- communication_clarity: how clearly they explained their reasoning
- problem_solving: ability to think through problems systematically
- relevance_to_role: how well their experience matches the position

Also provide:
- strengths: array of 2-5 specific strengths observed
- weaknesses: array of 2-5 specific weaknesses or gaps
- recommendation: one of [strong_yes, yes, maybe, no, strong_no]
- confidence: 0-100 (how confident you are in this assessment)

Respond ONLY with valid JSON in this exact format:
{
  "technical_depth": 4,
  "communication_clarity": 3,
  "problem_solving": 4,
  "relevance_to_role": 5,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "recommendation": "yes",
  "confidence": 78
}
```

**Parsing strategy:**
1. Try to extract JSON block from response (look for first `{` and last `}`)
2. Validate all required fields exist
3. Validate score ranges (1-5) and recommendation enum
4. If parsing fails, store raw response and set all scores to null
5. Retry with a stricter prompt (max 2 retries)

## Dashboard UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Adaptive Interview Engine                              [Logout]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Total    │  │ Active   │  │ Complete │  │ Avg Score│           │
│  │  47      │  │  12      │  │  35      │  │  3.8/5   │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
│  Filters: [All Status ▼] [All Positions ▼] [Search candidate...]   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Candidate          │ Position          │ Status   │ Actions │ │
│  ├────────────────────┼───────────────────┼──────────┼─────────┤ │
│  │ Alice Chen         │ Senior React Dev  │ Complete │ [View]  │ │
│  │ Bob Smith          │ Senior React Dev  │ In Prog  │ [Watch] │ │
│  │ Carol Davis        │ Staff Eng          │ Complete │ [View]  │ │
│  └────────────────────┴───────────────────┴──────────┴─────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Transcript + Evaluation Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Alice Chen — Senior React Developer Interview                      │
│  Completed · 8/8 turns · 24 minutes                                 │
│                                                                     │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐  │
│  │        Transcript          │  │      AI Evaluation           │  │
│  ├────────────────────────────┤  ├──────────────────────────────┤  │
│  │                            │  │                              │  │
│  │ 🤖 Q: Can you describe... │  │ Technical depth:    ★★★★☆   │  │
│  │                            │  │ Communication:      ★★★★☆   │  │
│  │ 👤 A: I have 5 years...   │  │ Problem solving:    ★★★☆☆   │  │
│  │                            │  │ Relevance:          ★★★★☆   │  │
│  │ 🤖 Q: Follow-up: How...   │  │                              │  │
│  │                            │  │ Overall: 3.8/5              │  │
│  │ 👤 A: We used Redux...    │  │                              │  │
│  │                            │  │ Recommendation: YES         │  │
│  │        ...                 │  │ Confidence: 78%             │  │
│  │                            │  │                              │  │
│  │                            │  │ Strengths:                   │  │
│  │                            │  │ • Strong React fundamentals│  │
│  │                            │  │ • Clear communication        │  │
│  │                            │  │                              │  │
│  │                            │  │ Weaknesses:                  │  │
│  │                            │  │ • Limited system design exp│  │
│  │                            │  │ • Shallow Docker answers   │  │
│  │                            │  │                              │  │
│  │                            │  │ [Add recruiter notes]       │  │
│  └────────────────────────────┘  └──────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Comparison View (Future / Stretch)

For two candidates on the same position:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Senior React Developer — Candidate Comparison                      │
├───────────────────┬─────────────────────┬───────────────────────────┤
│                   │ Alice Chen          │ Bob Smith                 │
├───────────────────┼─────────────────────┼───────────────────────────┤
│ Coverage          │ 85%                 │ 60%                       │
│ Technical depth   │ ★★★★☆               │ ★★★☆☆                     │
│ Communication     │ ★★★★☆               │ ★★★☆☆                     │
│ Problem solving   │ ★★★☆☆               │ ★★★★☆                     │
│ Relevance         │ ★★★★☆               │ ★★★★☆                     │
│ Recommendation    │ Yes                 │ Maybe                     │
│ Confidence        │ 78%                 │ 62%                       │
├───────────────────┴─────────────────────┴───────────────────────────┤
│  [View Alice transcript]          [View Bob transcript]            │
└─────────────────────────────────────────────────────────────────────┘
```

## Dependencies

No new dependencies. Reuses existing Ollama client. May optionally add `zod` for runtime JSON validation if we want to be strict about evaluation parsing.

## Performance Considerations

- Evaluation is triggered once, on demand (when recruiter clicks "Evaluate"), not automatically after every interview. This avoids unnecessary Ollama calls.
- Dashboard queries should be paginated (`LIMIT` + `OFFSET`) to avoid loading all sessions at once.
- Transcript page loads messages lazily — we already have this via `GET /api/sessions/[id]`.
