# Real-time Ollama Streaming — Design

## Overview

Keep the synchronous request/response shape of `POST /api/messages`, but stream Ollama tokens through a `ReadableStream`. Server accumulates the complete text and persists it to the database only when the Ollama stream ends.

## Architecture

```
Candidate submits answer
    │
    ▼
┌─────────────────────────────┐
│  POST /api/messages         │
│  ┌───────────────────────┐  │
│  │ 1. Validate session   │  │
│  │ 2. Store candidate msg│  │
│  │ 3. Generate embedding │  │
│  │ 4. Build prompt       │  │
│  │ 5. Call Ollama        │  │
│  │    stream: true       │  │
│  └───────────────────────┘  │
│            │                │
│            ▼                │
│    ┌───────────────┐        │
│    │ NDJSON chunks │        │
│    │  {message:    │        │
│    │   {content}}  │        │
│    └───────┬───────┘        │
│            │                │
│     ┌──────┴──────┐         │
│     ▼             ▼         │
│  Forward       Accumulate   │
│  to client     full text    │
│     │             │         │
│     ▼             ▼         │
│  Readable    On stream end: │
│  Stream      store full msg │
│              in DB          │
└─────────────────────────────┘
```

## Ollama Streaming Protocol

Ollama `/api/chat` with `stream: true` returns NDJSON (newline-delimited JSON):

```
{"model":"llama3.1","created_at":"...","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"llama3.1","created_at":"...","message":{"role":"assistant","content":" there"},"done":false}
...
{"model":"llama3.1","created_at":"...","message":{"role":"assistant","content":"!"},"done":true}
```

Each line is a JSON object. The `message.content` field contains the incremental token. `done: true` marks the final chunk.

## Server-Side Changes

### `src/lib/ollama.ts` — New streaming function

Add `generateChatResponseStream` that:
1. Calls Ollama with `stream: true`
2. Returns a `ReadableStream<Uint8Array>`
3. Internally parses NDJSON, emits plain text chunks to the consumer
4. Accumulates full text in a closure variable
5. Exposes `getFullText()` for post-stream retrieval

### `src/app/api/messages/route.ts` — Stream response

Current behavior:
- Awaits `generateChatResponse()` → gets full string
- Stores in DB → returns JSON

New behavior:
- Calls `generateChatResponseStream()` → gets `ReadableStream`
- Returns `new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })`
- **After** the stream completes, store the accumulated full text in DB

Wait, how do we store after returning Response?

```typescript
// Option 1: Don't wait — fire-and-forget (risky)
// Option 2: Use a transform stream that completes before Response resolves
// Option 3: Use Next.js's experimental waitUntil or similar
```

**Chosen approach: TransformStream + wait-until-close**

Use a `TransformStream` that:
- Passes chunks through to the client immediately
- Accumulates text in the transformer
- On `flush()`, calls an async function to store the message

In Next.js App Router, returning a Response doesn't prevent background work if the underlying stream hasn't closed. We can attach a `finally`-like handler to the stream closure.

Actually, simpler: use a `TextDecoderStream` + custom `TransformStream`:

```typescript
let fullText = "";

const transform = new TransformStream<Uint8Array, string>({
  transform(chunk, controller) {
    const text = decoder.decode(chunk, { stream: true });
    // parse NDJSON lines, extract content
    for (const line of text.split("\n").filter(Boolean)) {
      const data = JSON.parse(line);
      const content = data.message?.content || "";
      fullText += content;
      controller.enqueue(content);
    }
  },
  async flush() {
    // Store fullText in DB
    await db.insert(messages).values({ sessionId, role: "interviewer", content: fullText });
  }
});
```

Wait — the `flush` runs when the *writable* side closes, which is after Ollama finishes. But we return the *readable* side to the client. The client sees chunks immediately. The DB write happens after, in the same request lifecycle.

But what if the client disconnects? Then the readable is cancelled, writable may or may not close, `flush` may not run. For this design, we accept that risk. In practice, the client stays connected during normal operation.

## Frontend Changes

### `src/app/interview/[id]/page.tsx` — Consume stream

Current `handleSubmit`:
1. Optimistically add candidate message
2. `await fetch("/api/messages")`
3. `const result = await res.json()`
4. Add interviewer message from `result.content`

New `handleSubmit`:
1. Optimistically add candidate message
2. `fetch("/api/messages")` — don't await body yet
3. Create an optimistic interviewer message with empty content
4. Get `reader = res.body.getReader()`
5. Decode chunks and append to the optimistic message's content
6. On stream end, the message is "complete"

```typescript
const res = await fetch("/api/messages", { ... });
if (!res.ok) { /* handle error */ }

const reader = res.body!.getReader();
const decoder = new TextDecoder();

// Add empty interviewer message
const streamMessageId = `stream-${Date.now()}`;
setData(prev => ({
  ...prev,
  messages: [...prev.messages, { id: streamMessageId, role: "interviewer", content: "", createdAt: new Date().toISOString() }]
}));

let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // Update the stream message's content
  setData(prev => /* update content of streamMessageId */);
}
```

**Note:** Frequent `setData` calls during streaming could cause React re-render thrashing. Consider using a `useRef` for the accumulating content and a `requestAnimationFrame`-throttled update, or simply batch updates every ~50ms.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Ollama returns non-200 | Stream errors immediately. Frontend catches and shows error message. No DB row written. |
| Ollama stream interrupted mid-generation | Frontend sees partial text, then "Connection lost." No DB row written. |
| Embedding fails before stream starts | Returns 503 as today. No stream initiated. |
| Client disconnects during stream | Server's `flush` may not run. Acceptable — candidate can retry. |

## Data Model

No changes to the schema. The `messages` table still stores complete messages only. Streaming is a presentation-layer concern.

## Dependencies

No new dependencies. Uses browser-native `ReadableStream`, `TextDecoder`, `TransformStream`.

## Performance Considerations

- Embedding remains on critical path. First token appears after embedding + first Ollama chunk.
- Each `setData` during streaming triggers React re-render. Mitigate by updating only the specific message content or using refs.
- NDJSON parsing is cheap — just `JSON.parse` per line.
