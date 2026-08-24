# Design: Fix Audio Stop and Streaming Bugs

## Architecture

The fixes span both frontend (`ollama-chat-react`) and backend (`adaptive-interview-api`).

```
Frontend (SentenceAudioQueue)
    │
    ├─ Fix stop() to clear timeouts
    ├─ Remove permanent aborted flag (or reset it)
    └─ Prevent ghost onFinished callbacks

Frontend (transcript/page.tsx)
    │
    ├─ Add stoppedRef guard
    ├─ Cleanup old queue before creating new one
    └─ Reset speakAbortRef on new Speak

Frontend (voice/page.tsx)
    │
    ├─ Replace sentenceQueueRef.stop() on pause
    └─ Only create new queue per turn, not per pause

Backend (adaptive-interview-api/src/routes/voice.ts)
    │
    ├─ Assign globally-unique chunk indices (not per-sentence)
    ├─ Emit SSE events in index order
    └─ Concatenate split chunks into one buffer before emitting
```

## Component Design

### 1. SentenceAudioQueue — Resumable Queue

**Current problem:** `aborted = true` is permanent. `setTimeout` is not tracked.

**Fix:**
- Remove `aborted` as a permanent kill switch. Instead use a **generation counter**.
- Each `enqueue()` increments the generation. `stop()` marks the current generation as dead.
- `playNext()` checks `if (generation !== this.liveGeneration) return;`
- Track `pendingTimeout` ID and clear it in `stop()`.

```typescript
private liveGeneration = 0;
private pendingTimer: ReturnType<typeof setTimeout> | null = null;

stop() {
  this.liveGeneration++;       // old generation dies
  if (this.currentSource) {
    this.currentSource.onended = null;
    try { this.currentSource.stop(); } catch {}
    this.currentSource = null;
  }
  if (this.pendingTimer) {
    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
  this.items = [];
  this.preloaded.clear();
  this.isPlaying = false;
  this.currentIndex = -1;
}

playNext() {
  const myGen = this.liveGeneration;
  // ... later in async callbacks ...
  if (myGen !== this.liveGeneration) return;
}
```

This allows the same `SentenceAudioQueue` instance to be cleanly stopped and a fresh generation to begin, OR a new instance to replace the old one without ghost callbacks from the old instance's timers.

### 2. Transcript Page — Stopped Guard

**Current problem:**
```typescript
} catch (err) {
  if (err instanceof Error && err.name === "AbortError") {
    return;
  }
  await speakMessageFallback(text, msgId, engine);
}
```

**Fix:**
```typescript
const stoppedRef = useRef(false);

function stopSpeaking() {
  stoppedRef.current = true;
  cleanupStreamState();
  // ... rest of cleanup
}

async function speakMessageStream(...) {
  stoppedRef.current = false;
  // ...
  try {
    // ... SSE loop
  } catch (err) {
    if (stoppedRef.current) return;   // ← Guard added
    await speakMessageFallback(text, msgId, engine);
  }
}
```

### 3. Voice Interview Page — Queue Lifecycle

**Current problem:** Pause calls `sentenceQueueRef.current?.stop()`, permanently killing the queue.

**Fix:** Change pause/resume behavior:
- **Pause:** Suspend the `AudioContext` instead of destroying the queue. The queue keeps its items and will resume from where it left off when `AudioContext.resume()` is called and the next `playNext()` runs.
- **Stop (during recording/turn):** Keep the existing behavior of creating a fresh queue per turn, but ensure the old queue's timers are cleared.

Alternative (simpler): Since the voice interview `StreamingAudioQueue` only shows "Pause" and "Resume" for the *current* turn's sentence stream, and the queue is already designed to be short-lived, we can keep the per-turn queue creation but ensure the old queue is properly disposed before creating a new one.

### 4. Backend — Index Collision & Ordered Emission

**Current problem (index collision):**
```typescript
for (const { text, index } of iterator) {
  const results = await synthesizeChunkWithFallback(..., index);
  for (const result of results) {
    sendEvent("sentence", { index, ... });   // ← same index for all split results
  }
}
```

**Fix:** Accumulate split results and concatenate them into a single buffer with a **unique** index before emitting.

```typescript
for (const { text, index } of iterator) {
  const results = await synthesizeChunkWithFallback(..., index);
  if (results.length === 0) {
    sendEvent("sentence", { index, text, audioUrl: null });
  } else if (results.length === 1) {
    sendEvent("sentence", { index, text: results[0].text, audioUrl: results[0].urlPath });
  } else {
    // Multiple results from recursive split — concatenate WAV buffers
    const buffers = results.map(r => /* fetch buffer from r.urlPath */).filter(Boolean);
    const combined = concatWavBuffers(buffers);
    const { urlPath } = await saveAudio(sessionId, combined, `speak-chunk-${index}`, "wav");
    sendEvent("sentence", { index, text: results.map(r => r.text).join(" "), audioUrl: urlPath });
  }
}
```

Actually, `synthesizeChunkWithFallback` already saves each split result with a different file path but returns them under the same `index`. The simplest fix is to **concatenate the split buffers into one** before emitting a single SSE event.

**Ordered emission:** Instead of parallel worker pool emitting as they finish, use an ordered-await pattern:

```typescript
const results: Promise<{ index; text; audioUrl }>[] = [];
for (let i = 0; i < chunkTasks.length; i++) {
  results.push(synthesizeSingleChunk(i, chunkTasks[i]));
}

for (let i = 0; i < results.length; i++) {
  const result = await results[i];   // Wait for THIS index specifically
  sendEvent("sentence", result);
}
```

This emits index 0, then 1, then 2... in order. The browser can start playing immediately when index 0 arrives.

**Alternative (keeps parallelism):** Keep the parallel worker pool, but emit in order by awaiting the promises sequentially:

```typescript
const promises = chunkTasks.map((task, i) => synthesizeChunk(task, i));
for (const p of promises) {
  const result = await p;   // each await resolves when THAT index is ready
  sendEvent("sentence", result);
}
```

Since each promise is already running in parallel (started by the map), the total wall time is dominated by the slowest chunk, but emission is guaranteed ordered.

## Data Flow

### Transcript Speak → Stop → Speak

```
User clicks Speak
    │
    ▼
speakMessageStream()
    ├─ stoppedRef.current = false
    ├─ cleanupStreamState()   // stop old queue, clear old timers
    ├─ new SentenceAudioQueue()
    ├─ fetch SSE
    └─ enqueue chunks as they arrive
         │
         ▼
    User clicks Stop
         │
         ▼
    stopSpeaking()
         ├─ stoppedRef.current = true
         ├─ cleanupStreamState()
         └─ abort controller abort()
              │
              ▼
         SSE fetch rejects
              │
              ▼
         catch block: stoppedRef.current === true → return (no fallback)
```

## Testing Strategy

1. **Unit test SentenceAudioQueue** — Create, enqueue, stop, verify no ghost onFinished after 1 second.
2. **Manual test transcript page** — Speak long message (5+ sentences) → Stop mid-sentence → verify silence → Speak same message → plays from start.
3. **Manual test voice interview** — Submit answer → stream plays → click Pause → click Resume → continues from next sentence.
4. **Manual test phoneme split** — Submit answer that generates a long Vietnamese sentence → verify both halves are spoken.
5. **Build/lint** — `npm run build && npm run lint` in both repos.
