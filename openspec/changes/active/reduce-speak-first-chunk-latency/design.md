# Design: Reduce Speak First-Chunk Latency on Transcript Page

## Current Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: POST /api/voice/speak-stream                                      │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ split text   │─▶│ TTS chunk │─▶│ saveAudio    │─▶│ SSE sentence       │ │
│  │ into chunks  │  │ 0          │  │ (disk)       │  │ {index, audioUrl}  │ │
│  └──────────────┘  └───────────┘  └──────────────┘  └────────────────────┘ │
│                            │                                                │
│                            ▼                                                │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ TTS chunk 1  │─▶│ saveAudio │─▶│ SSE sentence │  │ {index, audioUrl}  │ │
│  └──────────────┘  └───────────┘  └──────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: TranscriptPage                                                   │
│  ┌────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐ │
│  │ SSE handler        │─▶│ SentenceAudioQueue  │─▶│ fetch audioUrl       │ │
│  │ enqueue chunk 0    │  │ playNext()          │  │ decodeAudioData      │ │
│  └────────────────────┘  └─────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

The frontend must fetch and decode each URL **after** receiving the SSE event. While chunk 0 is being fetched/decoded, the backend has already produced chunks 1, 2, 3…

## New Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: POST /api/voice/speak-stream                                      │
│  ┌──────────────┐  ┌───────────┐  ┌────────────────────────────────────────┐ │
│  │ split text   │─▶│ TTS chunk │─▶│ SSE sentence                           │ │
│  │ into chunks  │  │ 0          │  │ {index, audioData: "base64..."}        │ │
│  └──────────────┘  └───────────┘  └────────────────────────────────────────┘ │
│                            │                                                │
│                            ▼                                                │
│  ┌──────────────┐  ┌───────────┐  ┌────────────────────────────────────────┐ │
│  │ TTS chunk 1  │─▶│ (no save) │─▶│ SSE sentence                           │ │
│  └──────────────┘  └───────────┘  │ {index, audioData: "base64..."}        │ │
│                                   └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: TranscriptPage                                                   │
│  ┌────────────────────┐  ┌──────────────────────────┐  ┌───────────────┐ │
│  │ base64 → ArrayBuffer │─▶│ decodeAudioData          │─▶│ source.start  │ │
│  │ in SSE handler       │  │ (SentenceAudioQueue)     │  │ (play)        │ │
│  └────────────────────┘  └──────────────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

The URL fetch round-trip is removed. Playback starts as soon as the first chunk arrives.

## Component Changes

### 1. Backend: `adaptive-interview-api/src/routes/voice.ts`

Change `POST /api/voice/speak-stream` to use `synthesizeSpeechWithFallback` directly (which returns a `Buffer`) instead of `synthesizeChunkWithFallback` (which saves to disk and returns a URL).

Current SSE payload:
```json
{ "index": 0, "text": "Hello.", "audioUrl": "/audio/..." }
```

New SSE payload:
```json
{ "index": 0, "text": "Hello.", "audioData": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA..." }
```

For chunks that fail TTS or contain no synthesizable text, emit:
```json
{ "index": 1, "text": "...", "audioData": null }
```

Remove per-chunk `saveAudio` calls and the `savedUrls` cleanup loop for temporary chunk files. The final `done` event remains unchanged.

### 2. Frontend: `src/lib/audio/sentence-queue.ts`

Allow `enqueue()` to accept either a URL string or a pre-decoded `AudioBuffer`.

```ts
enqueue(index: number, audio: AudioBuffer | string, text?: string)
```

- If an `AudioBuffer` is passed, skip the fetch and decode path in `playNext()`.
- If a string URL is passed, keep the existing fetch/decode behavior for backward compatibility with `/api/voice/stream`.

### 3. Frontend: `src/app/interview/[id]/transcript/page.tsx`

In the SSE `sentence` handler:
1. Decode `audioData` from base64 to `ArrayBuffer`.
2. Call `audioCtxRef.current.decodeAudioData(arrayBuffer)`.
3. Pass the decoded `AudioBuffer` to `sentenceQueueRef.current.enqueue(index, audioBuffer, text)`.

If `audioData` is null or decoding fails, still call `enqueue` with a placeholder (e.g., an empty buffer or skip logic) so indices stay aligned and `flushPendingChunks` continues to work.

## API Change

`POST /api/voice/speak-stream` response SSE `sentence` event schema changes:

| Field | Before | After |
|-------|--------|-------|
| `audioUrl` | `string \| null` | removed |
| `audioData` | — | `string \| null` (base64 audio) |
| `index` | number | unchanged |
| `text` | string | unchanged |

## Dependencies

No new dependencies. We use built-in `Buffer`/`atob`/`btoa` for base64 and existing `decodeAudioData` API.

## Documentation Updates

- `docs/API.md`: update `POST /api/voice/speak-stream` response schema.
- `docs/ARCHITECTURE.md`: update the audio streaming data-flow note.
- `docs/CHANGELOG.md`: add entry for this optimization.

## Manual Validation

1. Open a transcript with a long interviewer message.
2. Open browser DevTools Network tab.
3. Click Speak.
4. Confirm audio starts before the SSE stream emits `done`.
5. Confirm audio plays all the way through and the button flips back to Speak.
6. Click Stop mid-stream: audio stops immediately.
7. Click Speak on message A, then Speak on message B while A is playing: A stops, B starts.
8. Run `npm run build` and `npm run lint` in both repos.
