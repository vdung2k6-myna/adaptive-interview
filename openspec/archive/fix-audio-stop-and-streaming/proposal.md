# Proposal: Fix Audio Stop and Streaming Bugs

## Problem

Three interconnected bugs in the audio playback pipeline cause the "Speak/Stop" feature to misbehave:

1. **Stop doesn't stop permanently** — `SentenceAudioQueue.stop()` sets `aborted = true`, but there is no way to reset it. After clicking Pause in the voice interview or Stop on the transcript page, the queue is permanently dead. Any subsequent attempt to enqueue/resume silently does nothing because `playNext()` exits early at `if (this.aborted) return;`.

2. **Ghost setTimeout fires after Stop** — When a sentence ends with punctuation, `playNext()` schedules the next chunk via `setTimeout`. Calling `stop()` does NOT clear this timeout. ~200–600 ms later the ghost callback fires, sees an empty queue, and calls `onFinished()`. On the transcript page this triggers `cleanupStreamState()` and `setSpeakingMsgId(null)`, which can corrupt the state of a *new* Speak session started in the interim.

3. **Fallback audio starts after user clicked Stop** — In `speakMessageStream()`, if the SSE fetch aborts with anything other than a pure `AbortError` (some browsers throw `TypeError: Failed to fetch` on abort), the code falls through to `speakMessageFallback()`. Because `stopSpeaking()` already cleared `speakingMsgId`, the fallback path sees no active speaker and starts playing the full combined WAV — the exact audio the user just tried to cancel.

4. **Backend split-chunk index collision** — In `/api/voice/speak-stream`, when `synthesizeChunkWithFallback` recursively splits a phoneme-overflowed chunk, it returns multiple results all with the same `index`. The frontend deduplicates by `index` and silently drops every result after the first, causing the second half of a split sentence to never be spoken.

5. **SSE events emitted out of order** — The backend worker pool synthesizes chunks in parallel (concurrency=3) and emits SSE events immediately as each completes. If chunk 0 is slow but chunks 1 and 2 finish first, the frontend buffers them until chunk 0 arrives. The user hears silence until the slowest chunk resolves, defeating the purpose of sentence-level streaming.

## Solution

Fix the `SentenceAudioQueue` class to be properly stoppable and restartable, add timeout cleanup, guard the transcript fallback path, fix backend index generation for split chunks, and emit SSE events in strict index order.

## Scope

### In Scope
- Fix `SentenceAudioQueue.stop()` to clear pending timeouts and allow a new instance (or reset) to work correctly
- Add `reset()` or refactor constructor pattern so transcript page can create fresh queues per Speak click without ghost callbacks
- Fix transcript page `stopSpeaking()` to prevent fallback from starting after intentional abort
- Fix backend `speak-stream` to emit unique sequential indices for split chunks
- Fix backend `speak-stream` to emit SSE events in strict index order
- Update voice interview page pause/resume to use correct queue lifecycle
- Update docs and run build/lint

### Out of Scope
- Refactoring the entire TTS pipeline or switching TTS engines
- Adding true pause/resume mid-sentence (stopping mid-sentence is acceptable for now)
- Docker or deployment changes

## Risks

| Risk | Mitigation |
|------|-----------|
| Fix introduces new race conditions in queue | Thoroughly test rapid Speak/Stop/Start sequences |
| Index-order emission slows overall throughput | Only wait on the *previous* index, not all future ones; gap-tolerant buffering |
| Ghost timeout still leaks in edge cases | Use a generation counter or clearTimeout idiom |

## Success Criteria

- [ ] Click Stop during transcript playback — audio stops immediately and does NOT restart
- [ ] Click Speak, wait for pause between sentences, click Stop — no ghost audio
- [ ] Click Speak → Stop → Speak on same message — second Speak works from beginning
- [ ] Voice interview streaming: first audio chunk plays within 6 seconds
- [ ] Sentence split by phoneme fallback plays both halves in order
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
