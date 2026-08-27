# Fix Audio Streaming Stop Regressions

## Problem

Two regressions have appeared in the TTS/audio pipeline:

1. **Audio only starts after all chunks are created.** When a user clicks Speak on a transcript message, playback does not begin as soon as the first sentence is synthesized. Instead, the UI appears to wait until the backend has produced every chunk before audio starts.
2. **Stop does not actually stop audio.** After the user clicks Stop, audio from the current message continues to play. This is especially visible when the non-streaming fallback path is used.

Both issues degrade the candidate/recruiter experience on the transcript page and make the voice interview feel unresponsive.

## Solution

Make the transcript audio path fully abortable and generation-aware, and close the fallback hole where Stop cannot cancel an in-flight combined-audio request:

1. Replace the non-abortable `speakMessageFallback` with an abortable implementation that shares the same `AbortController` / generation counter as the streaming path.
2. Ensure Stop increments the generation, aborts any pending request (stream or fallback), and clears the audio element before playback can begin.
3. Guard the streaming-to-fallback transition so we only fall back when the *current* Speak generation is still active.
4. On the voice interview page, add a per-turn generation counter and abort the previous SSE reader before starting a new turn, preventing stale chunks from leaking into the new queue.

## Scope (In)

- `src/app/interview/[id]/transcript/page.tsx` — generation-aware streaming + abortable fallback
- `src/app/interview/[id]/voice/page.tsx` — per-turn SSE abort + generation guard
- `src/lib/audio/sentence-queue.ts` — verify `stop()` correctly drops in-flight fetches (already implemented; confirm no regression)
- `adaptive-interview-api/src/routes/voice.ts` — add `AbortController` cleanup to `/api/voice/speak-stream` disconnect path (minor parity fix)
- `docs/CHANGELOG.md` and relevant audio docs

## Scope (Out)

- Rewriting the TTS engines or audio storage layer
- Changing the sentence-level gapless playback strategy
- Adding new UI features such as scrubbing or speed controls

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AbortController race aborts the *next* Speak by mistake | Medium | Tie abort controllers to a monotonic generation counter; never reuse an old controller |
| Fallback becomes abortable but still starts late | Low | Keep fallback as a last-reserve path; ensure streaming path emits index 0 eagerly |
| Voice page abort leaks `reader` | Low | Cancel reader and break loop when generation changes |
| Mobile UI regressions | Low | Only touch audio logic; do not alter responsive layout changes from `adaptive-mobile-ui` |

## Success Criteria

1. Clicking Speak on a transcript message starts audio as soon as the first SSE `sentence` event with a non-null `audioUrl` is received.
2. Clicking Stop while streaming aborts the SSE and stops playback; no further audio plays.
3. Clicking Stop while the fallback audio is loading aborts the request and prevents playback.
4. Rapidly switching between messages (Speak A → Speak B) does not leave audio from message A playing.
5. Voice interview: starting a new turn while the previous response is still streaming cleanly aborts the old stream and resets the queue.
6. `npm run build` and `npm run lint` pass (or only show pre-existing issues).
7. Docs updated.
