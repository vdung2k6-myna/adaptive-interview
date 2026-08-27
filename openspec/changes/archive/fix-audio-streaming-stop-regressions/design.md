# Design: Fix Audio Streaming Stop Regressions

## Overview

The audio regressions are caused by insufficient cancellation plumbing between the streaming TTS path, the combined-audio fallback path, and the UI Stop action. This change makes the transcript page and voice interview page fully generation-aware so that Stop reliably aborts every in-flight audio operation.

## Architecture

```
┌─────────────────────────────────────┐
│  TranscriptPage (client)            │
│  ┌───────────────────────────────┐  │
│  │ speakGenerationRef (number)   │  │  ← incremented on every Speak/Stop
│  │ speakAbortRef (AbortController) │  │  ← shared by stream + fallback
│  │ sentenceQueueRef              │  │
│  │ currentAudioRef               │  │
│  └───────────────────────────────┘  │
│              │                        │
│              ▼                        │
│  ┌───────────────────────────────┐  │
│  │ speakMessageStream            │  │
│  │ - starts SSE to speak-stream  │  │
│  │ - enqueues chunks as they arrive│ │
│  │ - on error, calls fallback    │  │
│  └───────────────────────────────┘  │
│              │                        │
│              ▼                        │
│  ┌───────────────────────────────┐  │
│  │ speakMessageFallback          │  │
│  │ - single POST /api/voice/speak│  │
│  │ - abortable via shared ctrl   │  │
│  │ - checks generation before play│ │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│  VoiceInterviewPage (client)        │
│  ┌───────────────────────────────┐  │
│  │ turnGenerationRef (number)    │  │  ← incremented on every recording
│  │ turnAbortRef (AbortController) │   │  ← aborts previous SSE reader
│  │ sentenceQueueRef              │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Transcript Page Changes

### 1. Unified abort controller

`speakAbortRef` will be created at the start of every Speak request and reused by both the SSE reader and the fallback fetch. `stopSpeaking()` will call `speakAbortRef.abort()` and then drop the reference.

### 2. Generation counter

`speakGenerationRef` already exists. We will extend its use into the fallback path:

- `speakMessageStream` captures `const myGen = ++speakGenerationRef.current`.
- `speakMessageFallback` accepts `myGen` and checks it before every async boundary and before calling `audio.play()`:
  ```ts
  if (myGen !== speakGenerationRef.current) return;
  ```
- `stopSpeaking()` increments `speakGenerationRef.current++`, invalidating both the streaming loop and the fallback.

### 3. Avoid stale-stream overwrite of a newer message

In `speakMessageStream`, the catch block currently calls `setSpeakingMsgId(null)` on AbortError. If a newer message is already playing, this would incorrectly clear its UI state. Change it to:

```ts
if (currentGen !== speakGenerationRef.current) {
  return; // stale — do not touch UI state
}
setSpeakingMsgId(null);
```

### 4. Make fallback abortable

Rewrite `speakMessageFallback` to accept `signal` and `myGen`:

```ts
async function speakMessageFallback(
  text: string,
  msgId: string,
  engine: string | undefined,
  playbackRate: number,
  signal: AbortSignal,
  myGen: number
) {
  // ...
  const res = await apiFetch("/api/voice/speak", { ...body, signal });
  if (signal.aborted || myGen !== speakGenerationRef.current) return;
  const blob = await res.blob();
  if (signal.aborted || myGen !== speakGenerationRef.current) return;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = playbackRate;
  currentAudioRef.current = audio;
  await audio.play(); // will throw if aborted, which is fine
}
```

If Stop is clicked while fetching, the signal is aborted, `myGen` becomes stale, and playback never starts.

### 5. Only fall back for the active generation

In `speakMessageStream`, before calling fallback:

```ts
if (myGen !== speakGenerationRef.current) return;
await speakMessageFallback(text, msgId, engine, playbackRate, abortCtrl.signal, myGen);
```

## Voice Interview Page Changes

### 1. Per-turn generation + abort

Add `turnGenerationRef` and `turnAbortRef` to the voice page. Increment the generation at the top of `handleRecordingComplete`. Store the AbortController in `turnAbortRef` and pass its signal to the SSE `apiFetch`.

Before each SSE loop iteration and before enqueuing a sentence, check `turnGenerationRef`:

```ts
if (myGen !== turnGenerationRef.current) {
  await reader.cancel();
  break;
}
```

### 2. Cancel previous SSE reader on new recording

At the top of `handleRecordingComplete`:

```ts
const myGen = ++turnGenerationRef.current;
if (turnAbortRef.current) {
  turnAbortRef.current.abort();
}
turnAbortRef.current = new AbortController();
```

The previous SSE reader will catch the abort and exit cleanly.

## Backend Changes

### `/api/voice/speak-stream` parity

The streaming route already has an `AbortController` for disconnect cleanup. Ensure the `onDisconnect` handler also aborts any in-flight `synthesizeChunkWithFallback` calls (it already cancels the controller; verify no gap).

No backend logic changes are required for the ordering behavior; the frontend already flushes chunks in strict index order, and the route emits sequentially.

## Documentation Updates

- `docs/CHANGELOG.md` — add dated entry under a new audio/playback section.
- `docs/ARCHITECTURE.md` — update the audio/data-flow notes to mention generation counters and shared abort controllers.
- `docs/OPENSPEC.md` — no workflow change; not required.

## Manual Validation Plan

1. Open a transcript page. Click Speak on a long interviewer message. Confirm audio starts before the progress bar reaches the end of the message.
2. While audio is playing, click Stop. Confirm audio stops immediately and the button returns to Speak.
3. Click Speak, then immediately click Stop. Confirm no audio plays.
4. Click Speak on message A, then click Speak on message B while A is still speaking. Confirm A stops and B starts.
5. In voice interview, submit an answer, then while the interviewer response is streaming, submit another answer. Confirm the old stream is aborted and the new response plays.
6. Run `npm run build` and `npm run lint`.
