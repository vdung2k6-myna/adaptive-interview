# Proposal: Fix Voice Interview Autoplay State Reset

## Problem

When a candidate completes their answer and submits the recording in a **voice interview**, the interviewer's auto-play audio **starts briefly and then stops** on all turns after the first one.

The first turn works correctly because `pendingChunksRef` and `nextExpectedIndexRef` start at their initial values (`empty Map` and `0`). On subsequent turns, these refs retain state from the previous turn, causing the sentence reorder/flush logic to look for the **wrong indices**.

## Root Cause

In `src/app/interview/[id]/voice/page.tsx`, the `handleRecordingComplete` function resets `hasReceivedSentencesRef` and `seenSentenceIndicesRef` at the start of each turn, but **omits** `pendingChunksRef` and `nextExpectedIndexRef`.

The transcript page (`src/app/interview/[id]/transcript/page.tsx`) correctly resets all four refs. The voice page was copied from that pattern but the reset for the reorder buffer was dropped.

## Impact

- **Voice interviews are broken after turn 1** — the interviewer speaks but the candidate hears silence (or only the tail end if there are enough sentences to eventually catch up).
- This is a **regression from the backend extraction** — the voice page was refactored during the monolith strip and the reset logic was lost.

## Solution

Add two missing state resets in `handleRecordingComplete`:

```typescript
pendingChunksRef.current.clear();
nextExpectedIndexRef.current = 0;
```

## Scope

### In Scope
- Add the two missing reset lines in `voice/page.tsx`
- Verify `npm run build` passes

### Out of Scope
- Any other voice interview changes
- Backend route changes

## Risks

| Risk | Mitigation |
|------|-----------|
| Reset breaks some other flow | The transcript page does the exact same reset and has been stable |
| TypeScript compilation | Will run `npx tsc --noEmit` before marking complete |

## Success Criteria

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] The two reset lines are present in `voice/page.tsx` after `seenSentenceIndicesRef.current.clear()`
