# Proposal: Reduce Speak First-Chunk Latency on Transcript Page

## Problem

On the transcript page, clicking **Speak** on an interviewer message starts audio playback only after several sentence chunks have already been synthesized. To the user it appears that "audio waits until all chunks are created."

The actual cause is a **second round-trip per chunk**:

1. Backend synthesizes chunk 0 and emits an SSE `sentence` event containing an `audioUrl`.
2. Frontend receives the event and enqueues chunk 0 in `SentenceAudioQueue`.
3. `SentenceAudioQueue` fetches the URL, decodes the audio buffer, and only then starts playback.
4. While the frontend is fetching/decoding chunk 0, the backend continues synthesizing chunks 1, 2, 3…

By the time the user hears anything, many chunks have been produced, creating the perception that playback is blocked until the whole message is ready.

## Solution

Embed the synthesized audio **directly in the SSE `sentence` event** as base64 data. The frontend can then decode and play the first chunk immediately, without an extra HTTP request.

```
Current flow:
TTS chunk 0 → saveAudio → SSE(audioUrl) → fetch URL → decodeAudioData → play

New flow:
TTS chunk 0 → SSE(audioData: base64) → decodeAudioData → play
```

The second round-trip disappears, so audio starts as soon as the first chunk is synthesized.

## Scope

In scope:
- Backend `POST /api/voice/speak-stream`
- Frontend `src/lib/audio/sentence-queue.ts`
- Frontend `src/app/interview/[id]/transcript/page.tsx`
- Documentation updates (`API.md`, `ARCHITECTURE.md`, `CHANGELOG.md`)

Out of scope (for this change):
- Voice interview streaming route (`POST /api/voice/stream`). It can receive the same optimization later if this proves successful.
- Non-streaming routes (`/speak`, `/start`, `/turn`) which already synthesize full audio before responding.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Base64 adds ~33% payload size | SSE bandwidth slightly higher | Chunk size is small (~60 chars of text → ~1–2 KB audio, ~1.3–2.7 KB base64). Negligible for LAN/dev use. |
| Larger messages may have bigger chunks | Decoding latency on main thread | Audio buffers remain small because `splitForTTS` caps chunks at ~60 chars. |
| Changing the SSE schema is a breaking API change | Frontend must be updated together | Deploy frontend and backend together; keep both repos in sync. |
| `decodeAudioData` errors with unexpected format | Audio may not play | Frontend keeps graceful handling: emit `audioData: null` when TTS fails and skip the chunk. |

## Success Criteria

- [ ] After clicking Speak, audio starts within ~200 ms of the first synthesized chunk (vs. the current multi-chunk delay).
- [ ] All sentences still play sequentially without gaps.
- [ ] Clicking Stop mid-stream still stops immediately.
- [ ] Clicking Speak on another message while one is playing switches cleanly.
- [ ] `npm run build` and `npm run lint` pass in both repositories.
- [ ] Relevant documentation is updated.
