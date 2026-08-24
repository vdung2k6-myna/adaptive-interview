# Evaluation Calibration — Tasks

## Phase 1: Database Migration

- [x] **Task 1: Create `evaluation_versions` table**
  Create new table with `ai_*` and `human_*` score columns, model tracking, and calibration flag. Include migration SQL in `migrations/`.

- [x] **Task 2: Migrate existing evaluations**
  Write migration script to copy existing `evaluations` rows into `evaluation_versions` with `humanCalibrated = false`.

- [x] **Task 3: Update Drizzle schema**
  Add `evaluationVersions` table definition to `src/lib/schema.ts` with all new columns.

## Phase 2: API Updates

- [x] **Task 4: Update GET /api/evaluations/:sessionId**
  Return latest evaluation plus version history array.

- [x] **Task 5: Update POST /api/sessions/:id/evaluate**
  Accept optional `model` parameter. Always create a new `evaluation_versions` row. Never overwrite.

- [x] **Task 6: Update PATCH /api/evaluations/:versionId**
  Accept `humanScores`, `humanRecommendation`, and `recruiterNotes`. Set `humanCalibrated = true` when any human score is entered.

- [x] **Task 7: Create DELETE /api/evaluations/:versionId**
  Allow deleting non-latest evaluation versions.

## Phase 3: UI Components

- [x] **Task 8: Create ScoreInput component**
  Editable number input (1-5) with star preview. Used for human score entry.

- [x] **Task 9: Create ModelBadge component**
  Small badge showing which LLM model generated an evaluation.

- [x] **Task 10: Create VersionHistory component**
  List of all evaluation versions for a session, with model and date.

- [x] **Task 11: Update transcript evaluation panel**
  Add human score inputs next to AI scores, model badge, version history, re-evaluate button with model selector.

## Phase 4: Dashboard & Compare

- [x] **Task 12: Update dashboard page**
  Show human-calibrated scores when available; fall back to AI scores. Add "Calibrated" / "AI-only" badges.

- [x] **Task 13: Update compare page**
  Add human score row below AI scores for each candidate.

## Phase 5: Validation

- [x] **Task 14: End-to-end validation**
  Run full interview, generate evaluation, enter human scores, verify:
  - Human scores persist after refresh
  - Dashboard shows calibrated scores
  - Multiple evaluations create versions
  - Model comparison displays correctly
  - Build passes, lint passes
