# Tasks: Fix Audio Stop and Streaming Bugs

## Phase 1: SentenceAudioQueue Core Fix

- [x] Replace permanent `aborted` flag with generation counter in `src/lib/audio/sentence-queue.ts`
- [x] Add `pendingTimer` tracking and clear it in `stop()`
- [x] Verify `playNext()` callbacks check generation before proceeding
- [x] Ensure `onFinished` does NOT fire from a ghost timer after `stop()`
- [x] Verify build passes in `ollama-chat-react`

## Phase 2: Transcript Page Stop Guard

- [x] Add `stoppedRef` to `src/app/interview/[id]/transcript/page.tsx`
- [x] Set `stoppedRef.current = true` in `stopSpeaking()`
- [x] Set `stoppedRef.current = false` at start of `speakMessageStream()`
- [x] Guard fallback in `speakMessageStream()` catch block: `if (stoppedRef.current) return;`
- [x] Verify `cleanupStreamState()` properly disposes old queue before new one starts

## Phase 3: Voice Interview Page Pause/Resume

- [x] Review `src/app/interview/[id]/voice/page.tsx` pause/resume logic
- [x] Replace destructive `sentenceQueueRef.current?.stop()` on pause with `AudioContext.suspend()` if possible
- [x] Ensure new turn always creates fresh queue and old queue timers are cleared
- [x] Verify pause → resume continues sequential playback without restart

## Phase 4: Backend speak-stream Fixes

- [x] Fix `POST /api/voice/speak-stream` in `adaptive-interview-api/src/routes/voice.ts`
- [x] Concatenate split-chunk results into single buffer before emitting one SSE event per original index
- [x] Revert ordered sequential await → keep parallel worker pool with immediate per-completion emission (ordered await broke streaming)
- [x] Fix CORS to allow production origin via comma-separated `FRONTEND_URL`
- [x] Revert frontend to direct backend URL to bypass Next.js proxy buffering
- [x] Verify backend builds (`npm run build` in `adaptive-interview-api`)
- [x] Add client disconnect detection in backend `speak-stream` to stop synthesis when SSE connection closes

## Phase 5: End-to-End Testing

- [x] Transcript: Speak long message → Stop mid-sentence → silence, no fallback
- [x] Transcript: Speak → Stop → Speak again → plays from start
- [x] Transcript: Speak, wait for pause between sentences, click Stop → no ghost audio
- [x] **Fix:** Guard SSE event processing loop with `stoppedRef.current` check (race condition where already-received bytes still get enqueued after Stop)
- [x] Voice interview: Submit → stream plays → Pause → Resume → continues
- [x] Voice interview: Long Vietnamese sentence triggers phoneme split → both halves spoken
- [x] Voice interview: First audio chunk within 6 seconds of submit

## Phase 6: Documentation

- [x] Update `docs/API.md` if speak-stream contract changed
- [x] Update `docs/CHANGELOG.md` with bug fix entry
- [x] Update `docs/COMPONENTS.md` if StreamingAudioQueue behavior changed
- [x] Run `npm run lint` in both repos
