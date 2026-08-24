# Proposal: Async Evaluation Polling

## Problem

The evaluation endpoint (`POST /api/sessions/:id/evaluate`) has been changed on the backend to run asynchronously via a job queue. It now returns `202 Accepted` with a `jobId` instead of the completed evaluation payload. The frontend's `transcript/page.tsx` still assumes a synchronous response and immediately tries to refetch the evaluation, which will either show stale data or nothing at all while the job runs.

## Root Cause

The `generateEvaluation()` function in `src/app/interview/[id]/transcript/page.tsx` performs a blocking POST and then calls `fetchEvaluation()` expecting the evaluation to exist. With the new async backend:

1. The POST returns before the LLM evaluation completes
2. `fetchEvaluation()` may return no evaluation (job still running)
3. The user sees no loading state and must manually refresh to see results

## Solution

Update the frontend to treat evaluation generation as an async job:

1. **POST** to `/api/sessions/:id/evaluate` → receive `{ jobId, status }`
2. **Poll** `GET /api/evaluations/jobs/:jobId` every 2 seconds
3. **Show loading UI** while polling ("Evaluating...")
4. **Display result** when `status === "completed"` (call existing `fetchEvaluation()`)
5. **Display error** when `status === "failed"` with retry option

## Scope

### In Scope
- Replace synchronous `generateEvaluation()` with async job flow in `transcript/page.tsx`
- Add polling logic with 2-second interval
- Add loading UI for "posting" and "polling" phases
- Handle job failure gracefully
- Ensure cleanup on unmount / re-evaluation
- Update `docs/API.md`, `docs/EVALUATION.md`, `docs/CHANGELOG.md`

### Out of Scope
- Backend job queue changes (already done)
- Dashboard changes (it reads existing evaluations, unaffected)
- Voice interview changes
- New reusable hook extraction (can be a follow-up)

## Risks

| Risk | Mitigation |
|------|-----------|
| Poll interval left running after unmount | `useEffect` cleanup returns `clearInterval` |
| User spams "Generate" creating many jobs | Disable button during `posting`/`polling` |
| Poll continues on re-evaluation | Clear interval and reset state before new POST |
| Browser sleep pauses interval | Acceptable — poll resumes on wake |

## Success Criteria

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Clicking "Generate Evaluation" shows "Starting evaluation..." then "Evaluating..."
- [ ] When job completes, evaluation panel auto-updates with results
- [ ] When job fails, error message appears with retryable button
- [ ] Re-evaluation while polling cancels old poll and starts new job
- [ ] Unmount during polling stops the interval (no leaks)
