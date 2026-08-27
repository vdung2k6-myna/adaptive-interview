# Tasks: Reduce Speak First-Chunk Latency on Transcript Page

## Backend

- [x] Update `POST /api/voice/speak-stream` in `adaptive-interview-api/src/routes/voice.ts` to synthesize chunks directly via `synthesizeSpeechWithFallback`.
- [x] Emit SSE `sentence` events with `{ index, text, audioData: base64Buffer }` instead of `{ index, text, audioUrl }`.
- [x] Emit `{ index, text, audioData: null }` for chunks that fail TTS or have no synthesizable content.
- [x] Remove per-chunk `saveAudio` calls and temporary chunk `savedUrls` cleanup in `speak-stream`.
- [x] Keep the final `done` event unchanged.

## Frontend

- [x] Update `SentenceAudioQueue.enqueue()` in `src/lib/audio/sentence-queue.ts` to accept `AudioBuffer | string`.
- [x] In `SentenceAudioQueue.playNext()`, skip fetch/decode when an `AudioBuffer` is already provided.
- [x] Update the SSE `sentence` handler in `src/app/interview/[id]/transcript/page.tsx` to decode `audioData` from base64 and pass the `AudioBuffer` to the queue.
- [x] Handle `audioData: null` or decode failures gracefully (skip the chunk without stalling playback).

## Documentation

- [x] Update `docs/API.md` with the new `POST /api/voice/speak-stream` `sentence` event schema.
- [x] Update `docs/ARCHITECTURE.md` audio streaming data-flow notes.
- [x] Add dated entry to `docs/CHANGELOG.md`.

## Validation

- [x] `npm run build` passes in `adaptive-interview`.
- [x] `npm run build` passes in `adaptive-interview-api`.
- [x] `npm run lint` passes in `adaptive-interview`.
- [x] `npm run lint` passes in `adaptive-interview-api`.
- [x] Manual test: backend `speak-stream` emits `audioData` base64 and first event arrives before `done` (~1.9s vs ~8.5s total).
- [x] Manual test: decoded first-chunk base64 is a valid WAV (RIFF/WAVE, 24kHz, 16-bit, ~1s).
- [x] Manual test: transcript page loads via frontend at `http://localhost:3000/interview/{id}/transcript`.
- [x] Manual test: clicking Speak on a long interviewer message starts audio before the SSE stream ends.
- [x] Manual test: Stop button works immediately mid-stream.
- [x] Manual test: switching messages works via Stop → Speak (direct Speak-on-another-message is intentionally disabled while one is playing).
