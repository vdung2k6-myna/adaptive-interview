# Fix Transcript Speak Stops After First Sentence

## Change

`fix-transcript-speak-stops-after-first-sentence`

## Problem

On the transcript page (`/interview/[id]/transcript`), clicking **Speak** on an interviewer message that contains "Node.js" or any sentence boundary followed by a longer clause plays only the first sentence and then stops. The UI button flips back from **Stop** to **Speak**, but the remaining audio never plays.

This happens because `SentenceAudioQueue` fires `onFinished` whenever its internal item queue becomes empty, which occurs naturally while waiting for the streaming TTS backend to synthesize the next sentence. The transcript page's `onFinished` handler immediately calls `cleanupStreamState()`, which:

1. Stops and nulls the audio queue.
2. Clears the pending-chunk reorder buffer.
3. Resets the next-expected index.

When the SSE `sentence` event for the next chunk finally arrives, `flushPendingChunks()` exits early because the queue is gone, and the chunk is silently dropped.

The voice interview page (`/interview/[id]/voice`) is not affected because its `onFinished` callback only updates UI state and does not tear down the queue or buffers.

## Scope

- **In scope:**
  - `src/app/interview/[id]/transcript/page.tsx` — queue lifecycle during `speakMessageStream`.
  - Minor cleanup of `speakMessageStream` error/finish guards so the queue survives streaming gaps.
- **Out of scope:**
  - Backend TTS/SSE behavior (already correct).
  - Audio file storage or playback engine changes.
  - Voice interview page (already handles this correctly).

## Risks

| Risk | Mitigation |
|------|------------|
| Queue leaks if `done` event never arrives | Keep existing `speakAbortRef` + `AbortController` timeout fallback; cleanup on page navigation remains. |
| UI "Stop" button state drifts if queue errors silently | Existing `onError` path still resets `speakingMsgId`; verify with manual test. |
| Multiple rapid Speak clicks race | Existing `speakGenerationRef` invalidation still guards against stale streams. |

## Success Criteria

- [ ] Clicking Speak on the bug text plays all sentences without stopping after "In a Node."
- [ ] Clicking Speak on long messages plays every sentence to completion.
- [ ] Clicking Stop mid-stream still stops immediately.
- [ ] Clicking Speak on a different message while one is playing switches cleanly.
- [ ] `npm run build` passes.
- [ ] `npm run lint` passes (or only pre-existing warnings).
