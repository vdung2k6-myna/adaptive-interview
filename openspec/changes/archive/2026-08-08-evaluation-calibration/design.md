# Evaluation Calibration — Design

## Architecture

The evaluation system is extended from a single-row-per-session model to a multi-version model that tracks both AI-generated and human-override scores.

```
Before:
┌─────────────────────────────────────────┐
│  evaluations (1 row per session)          │
│  ├── technicalDepth: 4                   │
│  ├── communicationClarity: 3           │
│  ├── ...                                 │
│  └── recommendation: "yes"             │
└─────────────────────────────────────────┘

After:
┌─────────────────────────────────────────┐
│  evaluation_versions (N rows per session)│
│  ├── sessionId                           │
│  ├── model: "llama3.1"                   │
│  ├── aiScores: {td: 4, cc: 3, ...}     │
│  ├── humanScores: {td: 5, cc: 4, ...}   │
│  ├── confidence: 78                      │
│  ├── recommendation: "yes"             │
│  ├── humanRecommendation: "strong_yes"    │
│  └── createdAt                           │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  evaluations (summary table)            │
│  ├── sessionId                           │
│  ├── latestVersionId                     │
│  ├── displayScores: (human || ai)        │
│  └── humanCalibrated: true/false       │
└─────────────────────────────────────────┘
```

## Database Schema

### Option A: Extend `evaluations` table (Minimal Migration)

Add columns to existing `evaluations` table:

| Column | Type | Description |
|--------|------|-------------|
| `humanTechnicalDepth` | `integer` | Recruiter override (1-5) |
| `humanCommunicationClarity` | `integer` | Recruiter override (1-5) |
| `humanProblemSolving` | `integer` | Recruiter override (1-5) |
| `humanRelevanceToRole` | `integer` | Recruiter override (1-5) |
| `humanRecommendation` | `text` | Recruiter override |
| `humanCalibrated` | `boolean` | Whether any human scores have been entered |
| `modelVersion` | `text` | Which model generated this evaluation |

**Pros:** Simple migration, existing queries mostly work  
**Cons:** No history of re-evaluations with different models

### Option B: New `evaluation_versions` table (Recommended)

Create a new table and migrate existing evaluations into it:

```sql
CREATE TABLE evaluation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  model TEXT NOT NULL,                    -- "llama3.1", "qwen2.5-coder", etc.
  raw_response TEXT NOT NULL,              -- Full LLM response

  -- AI-generated scores
  ai_technical_depth INTEGER,
  ai_communication_clarity INTEGER,
  ai_problem_solving INTEGER,
  ai_relevance_to_role INTEGER,
  ai_recommendation TEXT,
  ai_confidence INTEGER,

  -- Human override scores (NULL until recruiter enters them)
  human_technical_depth INTEGER,
  human_communication_clarity INTEGER,
  human_problem_solving INTEGER,
  human_relevance_to_role INTEGER,
  human_recommendation TEXT,

  -- Meta
  recruiter_notes TEXT,
  human_calibrated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Pros:** Full history, model comparison, clean separation of AI vs human  
**Cons:** Migration script needed, more queries to update

**Decision:** Use Option B. The project is young enough that a clean schema migration is preferable to accumulating technical debt.

## Data Access Patterns

### Fetch Latest Evaluation (Default)

```typescript
const latest = await db
  .select()
  .from(evaluationVersions)
  .where(eq(evaluationVersions.sessionId, sessionId))
  .orderBy(desc(evaluationVersions.createdAt))
  .limit(1);
```

### Fetch All Versions (Model Comparison)

```typescript
const versions = await db
  .select()
  .from(evaluationVersions)
  .where(eq(evaluationVersions.sessionId, sessionId))
  .orderBy(evaluationVersions.createdAt);
```

### Upsert Human Scores

```typescript
await db
  .update(evaluationVersions)
  .set({
    humanTechnicalDepth: 5,
    humanCommunicationClarity: 4,
    humanProblemSolving: null, // Not overridden
    humanCalibrated: true,
  })
  .where(eq(evaluationVersions.id, versionId));
```

## API Changes

### `GET /api/evaluations/:sessionId`

**Current:** Returns single evaluation  
**New:** Returns latest evaluation + list of all versions

```json
{
  "latest": {
    "id": "uuid",
    "sessionId": "uuid",
    "model": "llama3.1",
    "aiScores": {
      "technicalDepth": 4,
      "communicationClarity": 3,
      "problemSolving": 4,
      "relevanceToRole": 5
    },
    "humanScores": {
      "technicalDepth": 5,
      "communicationClarity": 4,
      "problemSolving": null,
      "relevanceToRole": null
    },
    "aiRecommendation": "yes",
    "humanRecommendation": null,
    "humanCalibrated": false,
    "confidence": 78,
    "recruiterNotes": null
  },
  "versions": [
    { "id": "uuid", "model": "llama3.1", "createdAt": "..." },
    { "id": "uuid", "model": "qwen2.5-coder", "createdAt": "..." }
  ]
}
```

### `POST /api/sessions/:id/evaluate`

**Current:** Generates evaluation with default model  
**New:** Accepts optional `model` parameter, always creates a new version

```json
// Request
{
  "model": "qwen2.5-coder"  // Optional, defaults to OLLAMA_MODEL
}

// Response
{
  "versionId": "uuid",
  "model": "qwen2.5-coder",
  "aiScores": { ... },
  "confidence": 82
}
```

### `PATCH /api/evaluations/:versionId`

**Current:** Updates recruiter notes  
**New:** Also accepts human scores and recommendation

```json
// Request
{
  "humanScores": {
    "technicalDepth": 5,
    "communicationClarity": 4
  },
  "humanRecommendation": "strong_yes",
  "recruiterNotes": "Strong candidate, recommend follow-up"
}
```

### `DELETE /api/evaluations/:versionId` (New)

Remove a specific evaluation version. Only allowed for non-latest versions (to prevent accidentally deleting the current evaluation).

## UI Design

### Transcript Page — Evaluation Panel

```
┌─────────────────────────────────────────┐
│  AI Evaluation                          │
│  Model: llama3.1  •  Confidence: 78%  │
│                                         │
│  Dimension          AI    Human       │
│  ─────────────────────────────────────  │
│  Technical Depth    ★★★★☆  [    ]     │
│  Communication      ★★★☆☆  [    ]     │
│  Problem Solving    ★★★★☆  [    ]     │
│  Relevance          ★★★★★  [    ]     │
│                                         │
│  AI: YES          Human: [________]     │
│                                         │
│  [Re-evaluate with different model]     │
│                                         │
│  ── Version History ──                 │
│  • llama3.1 — Aug 8, 2026             │
│  • qwen2.5-coder — Aug 8, 2026        │
│                                         │
└─────────────────────────────────────────┘
```

**Key design decisions:**
- Human score inputs are **number fields (1-5)** next to each AI star rating
- If human score is entered, it's shown alongside (not replacing) the AI score
- "Human calibrated" badge appears when any human score is entered
- Model selector in re-evaluate dropdown shows all available Ollama models (fetched from `/api/tags`)

### Dashboard Page

```
┌─────────────────────────────────────────┐
│  Avg Score: 4.2  (human-calibrated)     │
│                                         │
│  Candidate     Score     Status         │
│  ─────────────────────────────────────  │
│  Jane Doe      4.5 ★   Calibrated     │
│  John Smith    3.8 ★   AI-only        │
└─────────────────────────────────────────┘
```

**Rules:**
- If human scores exist → display average of human scores
- If no human scores → display average of AI scores
- Badge indicates whether score is "Calibrated" (human) or "AI-only"

### Compare Page

```
┌─────────────────────────────────────────┐
│           Alice          Bob            │
│  Model    llama3.1     qwen2.5        │
│                                         │
│  Tech     ★★★★☆ 4     ★★★★★ 5        │
│  Comm     ★★★★☆ 4     ★★★☆☆ 3        │
│  ProbSolv ★★★★☆ 4     ★★★★☆ 4        │
│  Relev    ★★★★★ 5     ★★★★☆ 4        │
│                                         │
│  Human    ★★★★★ 5     ★★★★☆ 4        │
│                                         │
└─────────────────────────────────────────┘
```

**New row:** Human scores displayed below AI scores for each candidate.

## Component Changes

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ScoreInput` | `src/components/ScoreInput.tsx` | Editable 1-5 score with star preview |
| `ModelBadge` | `src/components/ModelBadge.tsx` | Display which model generated an evaluation |
| `VersionHistory` | `src/components/VersionHistory.tsx` | List of evaluation versions for a session |
| `ConfidenceBar` | `src/components/ConfidenceBar.tsx` | Visual confidence indicator (0-100% bar) |

### Modified Components

| Component | Changes |
|-----------|---------|
| `EvaluationPanel` (in transcript page) | Add human score inputs, model badge, version history, re-evaluate button |
| `DashboardPage` | Show calibrated vs AI-only badges, use human scores when available |
| `ComparePage` | Add human score row below AI scores |

## Migration Strategy

1. Create `evaluation_versions` table
2. Migrate existing `evaluations` rows into `evaluation_versions`:
   - Set `model` from existing `model` column
   - Copy scores into `ai_*` columns
   - Leave `human_*` columns NULL
   - Set `humanCalibrated = false`
3. Drop old `evaluations` table or keep as view
4. Update all queries to read from `evaluation_versions`
5. Update API routes
6. Update UI components

## Dependencies

No new dependencies required. Existing stack:
- Drizzle ORM for migrations
- React form handling (useState is sufficient)

## Risks

| Risk | Mitigation |
|------|------------|
| Migration data loss | Backup database before running migration |
| UI becomes too complex | Progressive disclosure — hide advanced features behind "Show details" |
| Recruiter confusion about AI vs Human | Clear labeling, color coding (blue for AI, green for Human) |
