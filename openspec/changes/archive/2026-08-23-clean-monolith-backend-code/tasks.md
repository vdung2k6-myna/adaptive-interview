# Tasks: Clean Monolith Backend Code

## Phase 1: Backend Endpoint Enhancements (adaptive-interview-api repo)

- [x] Add `sessionCount` to `GET /api/candidates` response
  - Join with `interviewSessions`, group by `candidateId`, count sessions
  - Return `{ ...candidate, sessionCount: number }[]`
- [x] Add `sessionCount` to `GET /api/positions` response
  - Same pattern as candidates
- [x] Add `GET /api/campaigns/:id` endpoint
  - Query campaign by ID, 404 if not found
  - Query positions via `campaignPositions` join
  - Query sessions for those positions
  - Query evaluations (latest version per session)
  - Query candidates for those sessions
  - Compute metrics: totalSessions, completionRate, avgAiScore, avgHumanScore
  - Compute recommendation distribution
  - Compute top 5 candidates by humanAvg (fallback aiAvg)
  - Return `CampaignDetailResponse` shape
- [x] Test new backend endpoints with curl
  - ✅ `GET /api/candidates` — returns `sessionCount` per candidate
  - ✅ `GET /api/positions` — returns `sessionCount` per position
  - ✅ `GET /api/campaigns/:id` — returns positions, metrics, recommendations, topCandidates

## Phase 2: Frontend Types

- [x] Create `src/lib/types.ts` with interfaces: `Candidate`, `Position`, `Campaign`, `InterviewSession`, `EvaluationVersion`, `CampaignDetail`
- [x] Verify `sessionCount?: number` is included on `Candidate` and `Position`
- [x] Verify `CampaignDetail` includes `metrics`, `recommendations`, `topCandidates`, `positions`

## Phase 3: Convert Pages to Client Components

- [x] Convert `src/app/candidates/page.tsx`
  - Add `"use client"`
  - Replace `async function` → regular function
  - Add `useState` for `candidates`, `loading`, `error`
  - Add `useEffect` with `apiFetch("/api/candidates")`
  - Add loading skeleton (reuse existing styles)
  - Add error display
  - Import types from `@/lib/types`
- [x] Convert `src/app/candidates/[id]/edit/page.tsx`
  - Same pattern, fetch `/api/candidates/${id}`
  - Pass `initialData` to `CandidateForm` (still works)
- [x] Convert `src/app/positions/page.tsx`
  - Same pattern as candidates page
- [x] Convert `src/app/positions/[id]/edit/page.tsx`
  - Same pattern as candidate edit page
- [x] Convert `src/app/campaigns/page.tsx`
  - Already enriched by backend; simpler conversion
- [x] Convert `src/app/campaigns/[id]/page.tsx`
  - Fetch `/api/campaigns/${id}` (single call)
  - Remove all Drizzle query logic
  - Keep JSX layout and metric computations (now from API response)
- [x] Convert `src/app/campaigns/new/page.tsx`
  - Fetch `/api/positions` for dropdown
  - Or refactor `CampaignForm` to fetch positions itself
- [x] Convert `src/app/setup/page.tsx`
  - Parallel fetch: `/api/positions`, `/api/candidates`, `/api/sessions`
  - Compute usage maps in frontend from session data

## Phase 4: Delete Dead Backend Code

- [x] Delete `src/lib/db.ts`
- [x] Delete `src/lib/schema.ts`
- [x] Delete `src/lib/embeddings.ts`
- [x] Delete `src/lib/errors.ts`
- [x] Delete `src/lib/evaluation.ts`
- [x] Delete `src/lib/ollama.ts`
- [x] Delete `src/lib/prompts.ts`
- [x] Delete `src/lib/seed.ts`
- [x] Delete `src/lib/audio/client.ts`
- [x] Delete `src/lib/audio/index.ts`
- [x] Delete `src/lib/audio/split-sentences.ts`
- [x] Delete `src/lib/audio/storage.ts`
- [x] Delete `src/lib/audio/stt.ts`
- [x] Delete `src/lib/audio/text-processing.ts`
- [x] Delete `src/lib/audio/tts.ts`
- [x] Delete `src/lib/audio/wav-utils.ts`
- [x] Verify `src/lib/` only contains: `api-client.ts`, `types.ts`, `audio/sentence-queue.ts`, `config/*`

## Phase 5: Fix Import Chains

- [x] Check if `src/components/` imports any deleted files (indirectly)
- [x] Check if `src/lib/api-client.ts` or `src/lib/config/*` import deleted files
- [x] Run `npx tsc --noEmit` and fix all type errors
- [x] Update any remaining `@/lib/schema` or `@/lib/db` imports to use `@/lib/types`

## Phase 6: Build & Manual Verification

- [x] `npm run build` passes with zero errors
- [x] Navigate to `/candidates` — list loads with session counts (HTTP 200 ✓)
- [x] Navigate to `/candidates/:id/edit` — form loads with candidate data (HTTP 200 ✓)
- [x] Navigate to `/positions` — list loads with session counts (HTTP 200 ✓)
- [x] Navigate to `/positions/:id/edit` — form loads with position data (HTTP 200 ✓)
- [x] Navigate to `/campaigns` — list loads with counts (HTTP 200 ✓)
- [x] Navigate to `/campaigns/:id` — detail page loads with metrics and top candidates (HTTP 200 ✓)
- [x] Navigate to `/campaigns/new` — form loads with positions dropdown (HTTP 200 ✓)
- [x] Navigate to `/setup` — form loads with positions and candidates (HTTP 200 ✓)
- [x] No console errors in browser DevTools
  - **Verified by user:** all tests passed, no console errors observed

## Phase 7: Documentation

- [x] Update `docs/ARCHITECTURE.md` — remove DB layer from monolith diagram
- [x] Update `docs/COMPONENTS.md` — note list pages are now Client Components
  - **Verified:** No references to Server Components or DB access in this doc; no changes needed.
- [x] Update `docs/API.md` — document `GET /api/campaigns/:id` endpoint
- [x] Update `docs/CHANGELOG.md` — add entry for backend code cleanup
- [x] Update `docs/README.md` — if architecture description mentions direct DB access
  - **Verified:** No references to direct DB access in this doc; no changes needed.
