# Real-time Ollama Streaming — Tasks

## 1. Ollama Streaming Client

- [x] 1.1 Add `generateChatResponseStream()` to `src/lib/ollama.ts` that calls Ollama with `stream: true`
- [x] 1.2 Implement NDJSON parsing in the stream consumer — extract `message.content` from each line
- [x] 1.3 Return a `ReadableStream<string>` where each chunk is a single token string
- [x] 1.4 Accumulate full text internally and expose `getAccumulatedText()` for post-stream retrieval
- [x] 1.5 Handle `done: true` final chunk and close the stream
- [x] 1.6 Handle Ollama error responses (non-200) by aborting the stream and propagating the error
- [x] 1.7 Preserve timeout behavior (30s AbortController)

## 2. API Route Streaming

- [x] 2.1 Refactor `POST /api/messages` to return a `Response` with a `ReadableStream` body
- [x] 2.2 Pipe Ollama's NDJSON stream through a `TransformStream` that:
  - Forwards plain text chunks to the client immediately
  - Accumulates full text in the transformer
  - Stores the full message to DB in `flush()` after the stream completes
- [x] 2.3 Set response `Content-Type: text/plain; charset=utf-8`
- [x] 2.4 Ensure embedding failure still returns 503 before stream starts (unchanged behavior)
- [x] 2.5 Handle stream abort / client disconnect gracefully (no unhandled promise rejection)
- [x] 2.6 Update first-question generation path to also use streaming

## 3. Frontend Stream Consumer

- [x] 3.1 Refactor `handleSubmit` in `src/app/interview/[id]/page.tsx` to consume `ReadableStream`
- [x] 3.2 Add empty interviewer message optimistically when stream begins
- [x] 3.3 Read stream chunks with `response.body.getReader()` and `TextDecoder`
- [x] 3.4 Append decoded tokens to the optimistic message's content via state updates
- [x] 3.5 Throttle or batch React state updates to avoid render thrashing (e.g., every 50ms or using refs)
- [x] 3.6 On stream completion, mark message as complete (no special UI needed, just stop showing loader)
- [x] 3.7 On stream error, show error message and remove the optimistic partial message
- [x] 3.8 Update `generateFirstQuestion()` to also consume the stream
- [x] 3.9 Preserve existing "sending" loading state behavior (show loader only while embedding is happening, then show streaming message)

## 4. Error Handling & Edge Cases

- [x] 4.1 Test mid-stream Ollama failure — verify no DB row written, error shown
- [x] 4.2 Test client disconnect mid-stream — verify server doesn't crash
- [x] 4.3 Test slow Ollama response — verify timeout still works and stream is aborted
- [x] 4.4 Test successful end-to-end flow — verify complete message in DB matches streamed text

## 5. Cleanup & Polish

- [x] 5.1 Remove unused `stream: false` code path from `generateChatResponse` (or keep as fallback)
- [x] 5.2 Update any comments referencing the old non-streaming behavior
- [x] 5.3 Verify `fetchSession()` still works correctly after streaming (no stale/partial messages)
- [x] 5.4 Manual end-to-end test: setup → first question → answer → follow-up → max turns → complete
