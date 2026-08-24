# Tasks: Async Evaluation Polling

- [x] Refactor `transcript/page.tsx`: replace `evalLoading`/`evalError` booleans with `EvalJobState` discriminated union
- [x] Implement `startEvaluationJob()` — POST /evaluate, handle 202, set `posting` → `polling`
- [x] Implement polling `useEffect` — GET /jobs/:jobId every 2s, handle completed/failed/running
- [x] Update UI: show loading states for `posting` and `polling`, show error for `failed`
- [x] Ensure cleanup: interval cleared on unmount, re-evaluation, and state reset
- [x] Verify re-evaluation flow: clicking "Run New Evaluation" cancels old poll and starts new job
- [x] Run `npx tsc --noEmit`
- [x] Run `npm run build` — passed
- [x] Update `docs/API.md` — document async evaluation endpoints
- [x] Update `docs/EVALUATION.md` — describe new job-based flow
- [x] Update `docs/CHANGELOG.md` — add entry for async evaluation
- [x] Fix version history not updating on completed job — use `job.result` directly instead of relying on `fetchEvaluation()` race
- [x] Re-run `npx tsc --noEmit` after fix
