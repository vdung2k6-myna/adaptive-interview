# Design: Fix Transcript Speak Stops After First Sentence

## Root Cause

The transcript page uses streaming TTS (`POST /api/voice/speak-stream`). The backend emits `sentence` events as each sentence chunk is synthesized. The frontend queues those chunks in `SentenceAudioQueue` and plays them sequentially.

```
User clicks Speak
    │
    ▼
speakMessageStream()
    │
    ▼
POST /api/voice/speak-stream (SSE)
    │
    ▼
SSE sentence event 0 → enqueue chunk 0 → play
SSE sentence event 1 → enqueue chunk 1 → play next when chunk 0 ends
...
SSE done event → all chunks emitted
```

`SentenceAudioQueue` calls `onFinished` whenever the local `items` array becomes empty. If chunk 0 finishes before the SSE event for chunk 1 arrives, the queue becomes empty momentarily. The transcript page interprets that as "playback is finished" and destroys the queue, causing every later chunk to be dropped.

## Fix

Track whether the SSE stream has actually completed separately from whether the audio queue is momentarily empty. Only tear down the queue when **both** are true:

1. The backend has emitted `event: done`.
2. The queue has drained its last item.

### State changes in `transcript/page.tsx`

Add a ref to remember stream completion:

```typescript
const speakStreamDoneRef = useRef(false);
```

In `cleanupStreamState()`, reset it:

```typescript
speakStreamDoneRef.current = false;
```

When creating the queue inside `speakMessageStream`, guard `onFinished`:

```typescript
sentenceQueueRef.current = new SentenceAudioQueue(audioCtxRef.current, {
  playbackRate,
  onFinished: () => {
    if (speakStreamDoneRef.current) {
      cleanupStreamState();
      setSpeakingMsgId(null);
    }
    // Otherwise: keep queue alive; more SSE chunks are still in flight.
  },
});
```

In the SSE handler, on `event: done`:

```typescript
case "done": {
  speakStreamDoneRef.current = true;
  if (
    sentenceQueueRef.current &&
    !sentenceQueueRef.current.getIsPlaying() &&
    sentenceQueueRef.current.getQueueLength() === 0
  ) {
    cleanupStreamState();
    setSpeakingMsgId(null);
  }
  break;
}
```

Also reset `speakStreamDoneRef.current = false` at the top of `speakMessageStream` to ensure each new Speak click starts fresh.

## Files Changed

| File | Change |
|------|--------|
| `src/app/interview/[id]/transcript/page.tsx` | Add `speakStreamDoneRef`, guard `onFinished`, handle `done` event, reset ref in `cleanupStreamState` and `speakMessageStream`. |

## No API / Database / Dependency Changes

- No backend changes.
- No schema changes.
- No new dependencies.

## Testing Plan

1. Manual test with the bug text:
   - Navigate to a transcript containing `In a Node.js service using PgBouncer, ...`
   - Click Speak.
   - Verify all sentences play and the button flips back to Speak at the end.
2. Manual test with a short single-sentence message.
3. Manual test clicking Stop mid-stream.
4. Manual test clicking Speak on message B while message A is playing.
5. Run `npm run build`.
6. Run `npm run lint`.

## Documentation

Not required — this is a bug fix with no user-facing behavior change beyond "works as expected". No docs need updating.
