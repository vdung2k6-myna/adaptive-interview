# Design: Clean Monolith Backend Code

## Architecture

After this change, the monolith is a pure frontend with no backend knowledge:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Monolith (Frontend Only)                         │
├─────────────────────────────────────────────────────────────────────┤
│  src/app/                                                            │
│    ├── candidates/page.tsx        ← Client Component, apiFetch       │
│    ├── positions/page.tsx         ← Client Component, apiFetch       │
│    ├── campaigns/page.tsx         ← Client Component, apiFetch       │
│    ├── campaigns/[id]/page.tsx    ← Client Component, apiFetch       │
│    ├── setup/page.tsx             ← Client Component, apiFetch       │
│    └── ... (other pages already use apiFetch)                       │
│  src/components/                                                     │
│    ├── DeleteButton.tsx             ← already uses apiFetch          │
│    ├── CampaignForm.tsx           ← already Client Component       │
│    ├── CandidateForm.tsx          ← already Client Component       │
│    └── PositionForm.tsx           ← already Client Component       │
│  src/lib/                                                            │
│    ├── api-client.ts                ← fetch wrapper                │
│    ├── types.ts                     ← lightweight TS interfaces      │
│    ├── audio/                       │
│    │   └── sentence-queue.ts      ← UI audio playback only         │
│    └── config/                      ← env/config                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP /api/*, /audio/*
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Backend (:4000)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  GET  /api/candidates          ← now includes sessionCount           │
│  GET  /api/positions           ← now includes sessionCount           │
│  GET  /api/campaigns           ← already includes counts             │
│  GET  /api/campaigns/:id       ← NEW: full detail + aggregates     │
│  GET  /api/sessions            ← existing                            │
│  POST /api/messages            ← existing                            │
│  ...                                                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Backend Endpoint Enhancements

### `GET /api/candidates` — enriched

Add `sessionCount` to each candidate row by joining with `interviewSessions`:

```typescript
const rows = await db.select().from(candidates).orderBy(candidates.createdAt);

const sessionCounts = await db
  .select({ candidateId: interviewSessions.candidateId, count: count() })
  .from(interviewSessions)
  .groupBy(interviewSessions.candidateId);

const countMap = new Map(sessionCounts.map((s) => [s.candidateId, s.count]));

const results = rows.map((c) => ({
  ...c,
  sessionCount: countMap.get(c.id) || 0,
}));

res.json(results);
```

### `GET /api/positions` — enriched

Same pattern as candidates. Add `sessionCount` per position.

### `GET /api/campaigns/:id` — NEW

Returns a single campaign with all related data pre-aggregated:

```typescript
interface CampaignDetailResponse {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  tags: string[];
  positions: Array<{
    id: string;
    title: string;
    level: string;
    requirements: string[];
  }>;
  metrics: {
    totalSessions: number;
    completionRate: number;
    avgAiScore: number | null;
    avgHumanScore: number | null;
  };
  recommendations: Record<string, number>;
  topCandidates: Array<{
    sessionId: string;
    candidateName: string;
    aiAvg: number | null;
    humanAvg: number | null;
    recommendation: string | null;
  }>;
}
```

Implementation mirrors the current monolith's `campaigns/[id]/page.tsx` logic — all the Drizzle queries move to the backend route. This keeps the frontend simple (1 API call).

## Frontend Conversion Pattern

### Before (Server Component with DB)

```typescript
import { db } from "@/lib/db";
import { candidates, interviewSessions } from "@/lib/schema";
import { count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const rows = await db.select().from(candidates);
  // ... more queries ...
  return <Table rows={rows} />;
}
```

### After (Client Component with apiFetch)

```typescript
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Candidate } from "@/lib/types";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/candidates")
      .then((r) => r.json())
      .then((data: Candidate[]) => setCandidates(data))
      .catch(() => setError("Failed to load candidates"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage message={error} />;

  return <Table rows={candidates} />;
}
```

### Loading & Error States

Each converted page needs:
- A loading skeleton or spinner
- An error message display
- `useEffect` with empty dependency array for initial load

For pages with multiple parallel fetches (setup, campaign detail), use `Promise.all`:

```typescript
useEffect(() => {
  Promise.all([
    apiFetch("/api/positions").then((r) => r.json()),
    apiFetch("/api/candidates").then((r) => r.json()),
    apiFetch("/api/sessions").then((r) => r.json()),
  ])
    .then(([positions, candidates, sessions]) => {
      // compute usage counts in frontend
    })
    .catch(() => setError("..."))
    .finally(() => setLoading(false));
}, []);
```

## Type Definitions (`src/lib/types.ts`)

Extract only the shapes the frontend needs:

```typescript
export interface Candidate {
  id: string;
  name: string;
  email: string;
  skills: string[];
  experienceYears: number | null;
  cv: string | null;
  createdAt: string;
  sessionCount?: number;
}

export interface Position {
  id: string;
  title: string;
  level: string;
  jobDescription: string | null;
  requirements: string[];
  createdAt: string;
  sessionCount?: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  tags: string[];
  positionCount?: number;
  sessionCount?: number;
}

export interface InterviewSession {
  id: string;
  positionId: string;
  candidateId: string;
  status: string;
  mode: string;
  currentTurn: number;
  maxTurns: number;
  createdAt: string;
}

export interface EvaluationVersion {
  id: string;
  sessionId: string;
  aiTechnicalDepth: number | null;
  aiCommunicationClarity: number | null;
  aiProblemSolving: number | null;
  aiRelevanceToRole: number | null;
  humanTechnicalDepth: number | null;
  humanCommunicationClarity: number | null;
  humanProblemSolving: number | null;
  humanRelevanceToRole: number | null;
  aiRecommendation: string | null;
  createdAt: string;
}

export interface CampaignDetail extends Campaign {
  positions: Position[];
  metrics: {
    totalSessions: number;
    completionRate: number;
    avgAiScore: number | null;
    avgHumanScore: number | null;
  };
  recommendations: Record<string, number>;
  topCandidates: Array<{
    sessionId: string;
    candidateName: string;
    aiAvg: number | null;
    humanAvg: number | null;
    recommendation: string | null;
  }>;
}
```

## File Cleanup

Delete these files (zero frontend imports):

| File | Reason |
|------|--------|
| `src/lib/db.ts` | Database connection — frontend should not have |
| `src/lib/schema.ts` | Drizzle schema — replaced by `types.ts` |
| `src/lib/embeddings.ts` | Backend-only (Ollama embeddings) |
| `src/lib/errors.ts` | Backend-only error classes |
| `src/lib/evaluation.ts` | Backend-only (AI evaluation engine) |
| `src/lib/ollama.ts` | Backend-only (Ollama client) |
| `src/lib/prompts.ts` | Backend-only (LLM prompts) |
| `src/lib/seed.ts` | Backend-only (DB seeding) |
| `src/lib/audio/client.ts` | Backend audio client |
| `src/lib/audio/index.ts` | Backend audio exports |
| `src/lib/audio/split-sentences.ts` | Backend text processing |
| `src/lib/audio/storage.ts` | Backend file storage |
| `src/lib/audio/stt.ts` | Backend speech-to-text |
| `src/lib/audio/text-processing.ts` | Backend text processing |
| `src/lib/audio/tts.ts` | Backend text-to-speech |
| `src/lib/audio/wav-utils.ts` | Backend WAV generation |

## Data Flow

```
Browser → Next.js (:3000) → rewrite → Backend (:4000)
   │
   ▼
Client Component loads
   │
   useEffect ──apiFetch──▶ /api/candidates  (enriched with sessionCount)
   useEffect ──apiFetch──▶ /api/positions   (enriched with sessionCount)
   useEffect ──apiFetch──▶ /api/campaigns/:id (full detail)
   │
   ▼
React state update → render table / form / dashboard
```

## Error Handling

Each Client Component page follows this pattern:

1. `loading` state → render skeleton/spinner
2. `error` state → render error message with retry button
3. Success → render content

Retry button calls the fetch function again.

## Security

- `apiFetch` still injects `Authorization: Bearer <token>`
- No change to auth model
- CORS already configured in backend

## Testing Strategy

1. Build passes: `npm run build` (catches type errors from schema deletion)
2. Navigate to each converted page in browser, verify data loads
3. Verify session counts appear on list pages
4. Verify campaign detail shows metrics and top candidates
5. Verify setup page loads positions and candidates

## Documentation Updates

| Document | Change |
|----------|--------|
| `docs/ARCHITECTURE.md` | Update layer diagram: monolith no longer has DB layer |
| `docs/COMPONENTS.md` | Note that list pages are now Client Components |
| `docs/CHANGELOG.md` | Add entry for backend code cleanup |
| `docs/API.md` | Document new `GET /api/campaigns/:id` endpoint |
