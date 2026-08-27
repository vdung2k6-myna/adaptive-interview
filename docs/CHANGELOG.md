# Changelog

> **Path migration note:** During the 2026-08 backend extraction, files under `src/app/api/*`, `src/lib/db.ts`, `src/lib/schema.ts`, `src/lib/ollama.ts`, `src/lib/evaluation.ts`, `src/lib/prompts.ts`, `src/lib/embeddings.ts`, `src/lib/seed.ts`, `src/lib/mcp/*`, and most of `src/lib/audio/*` moved to the standalone [`adaptive-interview-api`](https://github.com/vdung2k6-myna/adaptive-interview-api) repository (default branch `master`). Historical entries below still name their original monolith paths. Current frontend files live under `src/app/*`, `src/components/*`, `src/lib/api-client.ts`, `src/lib/config/*`, `src/lib/types.ts`, `src/lib/use-playback-rate.ts`, and `src/lib/audio/sentence-queue.ts`.

## 2026-08-27

### Add PWA Support for Android Installability

**Change:** `add-pwa-android-installability` (OpenSpec)

**Problem:** Candidates open anonymous interview links on Android phones, but the app runs only as a browser tab with no home-screen icon, no splash screen, and browser chrome competing for attention during voice interviews.

**Solution:** Added Progressive Web App scaffolding so Chrome on Android can install the app and launch it in a standalone, chromeless window.

**What changed:**
- Assets:
  - Created `public/manifest.json` with app metadata, theme colors, and icon set
  - Generated `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable.png`, and `public/apple-touch-icon.png` via `scripts/generate-pwa-icons.mjs`
  - Created `public/offline.html` and `src/app/offline/page.tsx` as offline fallback pages
- Service worker:
  - Created `public/sw.js` — precaches the shell, caches immutable `/_next/static/*` chunks, uses network-first for API/audio, and serves an offline fallback
  - Registered the service worker from `src/app/layout.tsx` with a small client-side script
  - `scripts/postbuild.mjs` now stamps the service worker cache version with a per-build id and copies `public/` into `.next/standalone/public/`
- Layout:
  - Updated `src/app/layout.tsx` with `theme-color`, `manifest`, and `apple-touch-icon` meta/link tags
- Documentation:
  - Updated `docs/SETUP.md` with PWA deployment and HTTPS requirements
  - Updated `docs/ARCHITECTURE.md` with a PWA/service worker section
  - Updated `docs/CHANGELOG.md`

**Status:** Implemented and documented. Manual Android install/standalone/voice testing required for full validation.

---

## 2026-08-27

### Make Web UI Mobile Adaptive

**Change:** `adaptive-mobile-ui` (OpenSpec)

**Problem:** Admin and interview pages were built for desktop widths. On phones the tables overflowed, form inputs triggered iOS auto-zoom, buttons were too small to tap reliably, and the navigation bar wrapped or clipped.

**Solution:** Applied a mobile-first responsive pass across the frontend: collapsible navigation, table-to-card lists on narrow screens, larger touch targets, and `text-base` form controls to prevent zoom.

**What changed:**
- Navigation:
  - Created `src/components/MobileNav.tsx` hamburger menu
  - Updated `src/app/layout.tsx` to show `MobileNav` on small screens and keep desktop links on `md:` and up
- Admin list pages:
  - `src/app/dashboard/page.tsx` — mobile card list, responsive filters/stats
  - `src/app/positions/page.tsx` — mobile cards with Edit/Delete touch targets
  - `src/app/candidates/page.tsx` — mobile cards with skill/status chips
  - `src/app/campaigns/page.tsx` — mobile cards with dates/sessions
- Detail/comparison pages:
  - `src/app/campaigns/[id]/page.tsx` — responsive metrics grid, card lists for top candidates and positions
  - `src/app/compare/page.tsx` — horizontal scroll wrapper for the comparison table
- Interview pages:
  - `src/app/interview/[id]/page.tsx` — stacked header, `text-base` chat input to prevent iOS zoom
  - `src/app/interview/[id]/voice/page.tsx` — stacked header, larger recorder/playback controls
  - `src/app/interview/[id]/transcript/page.tsx` — larger Speak/Stop and calibration controls
- Forms and setup:
  - `src/app/setup/page.tsx` and `SetupForm.tsx` — responsive padding, `text-base` selects/buttons, larger mode/voice toggles
  - `src/app/positions/new/PositionForm.tsx`, `src/app/candidates/new/CandidateForm.tsx`, `src/app/campaigns/new/CampaignForm.tsx`, plus edit wrappers — `text-base` inputs, `min-h-[44px]` buttons, larger tag/skill/requirement remove targets
- Shared components:
  - `src/components/DeleteButton.tsx` — `min-h-[44px]` touch target
  - `src/components/ScoreInput.tsx` — larger star touch targets on mobile
  - `src/components/VersionHistory.tsx` — larger delete button
  - `src/components/AudioRecorder.tsx` — larger record/stop/submit/discard targets
- Documentation:
  - Updated `docs/COMPONENTS.md` with `MobileNav` and responsive notes
  - Updated `docs/CHANGELOG.md`

**Status:** Implemented and documented. Validation via `npm run build` / `npm run lint` and manual mobile viewport checks pending.

---

## 2026-08-27

### Fix Audio Streaming Stop Regressions

**Change:** `fix-audio-streaming-stop-regressions` (OpenSpec)

**Problem:** Two audio regressions appeared in the TTS pipeline:
1. Clicking **Speak** on a transcript message did not start audio when the first sentence was ready; playback appeared to wait until every chunk had been produced.
2. Clicking **Stop** did not reliably stop playback. Audio from the current message continued, especially when the non-streaming fallback path was active.

**Root Cause:**
- The non-streaming fallback (`speakMessageFallback`) was not abortable, so a Stop click that arrived while the combined-audio fetch was in flight could not prevent the resulting `<audio>` element from playing.
- The streaming path's catch handler unconditionally cleared the UI state, which could wipe a newer active Speak request when an older SSE reader finally aborted.
- The voice interview page had no per-turn cancellation; a stale SSE reader from a previous turn could leak events into the new turn's sentence queue.
- Backend SSE events were not explicitly flushed through any buffering middleware, so clients could receive batched events late.

**Solution:**
- Made `speakMessageFallback` accept a shared `AbortSignal` and generation counter; it bails out before decoding or playing if Stop/supersession occurred.
- Guarded all transcript streaming cleanup/fallback transitions with the generation counter so only the active Speak generation mutates UI state.
- Added `turnGenerationRef` and `turnAbortRef` to the voice interview page; each new recording aborts the previous SSE reader and ignores stale events.
- Added `res.flush?.()` to the backend SSE helper so events are pushed immediately.

**What changed:**
- `src/app/interview/[id]/transcript/page.tsx`:
  - `speakMessageFallback` now takes `signal` and `myGen` and checks them before every async boundary and before playback.
  - `speakMessageStream` passes its `AbortController` signal and generation to fallback.
  - Catch block no longer clears UI state when the generation has changed.
  - `done`/end-of-stream guards are generation-aware.
- `src/app/interview/[id]/voice/page.tsx`:
  - Added `turnGenerationRef` and `turnAbortRef`.
  - New recording increments generation, aborts previous SSE reader, and passes an `AbortSignal` to `apiFetch`.
  - SSE loop, `candidate`, `sentence`, `done`, and `error` handlers all guard against stale generations.
- `adaptive-interview-api/src/routes/voice.ts`:
  - `sendSseEvent` now calls `res.flush?.()` after writing each event.
- Documentation:
  - Updated `docs/CHANGELOG.md` (this entry)
  - Updated `docs/ARCHITECTURE.md` audio flow notes

**Status:** Implemented and documented. Manual Speak/Stop and voice-turn validation pending.

---

## 2026-08-24

### Fix Transcript Speak Stopping After First Sentence

**Change:** `fix-transcript-speak-stops-after-first-sentence`

**Problem:** On the transcript page, clicking **Speak** on messages containing sentence boundaries (e.g., "In a Node.js service...") played only the first sentence and then stopped. The UI button flipped back to **Speak**, but the rest of the audio never played.

**Root Cause:** `SentenceAudioQueue` fires `onFinished` whenever its local item queue momentarily becomes empty while waiting for the next SSE chunk to arrive. The transcript page interpreted that empty queue as "playback finished" and destroyed the queue and chunk buffers, causing all subsequent chunks to be dropped.

**Solution:** Track SSE stream completion separately from queue emptiness. The queue and buffers are only torn down when the backend has emitted `event: done` **and** the queue has drained its last item.

**What changed:**
- `src/app/interview/[id]/transcript/page.tsx`:
  - Added `speakStreamDoneRef` to remember when the SSE stream has emitted all chunks.
  - Guarded `SentenceAudioQueue.onFinished` so it only cleans up when `speakStreamDoneRef.current` is true.
  - Handled the SSE `done` event by setting `speakStreamDoneRef.current = true` and checking whether the queue is already idle.
  - Reset `speakStreamDoneRef.current` in `cleanupStreamState()` and at the start of `speakMessageStream()`.

---

## 2026-08-24

### Add Playback Rate Control for AI Voice

**Change:** `add-playback-rate-control`

**Problem:** AI voice playback was locked to a hardcoded `0.9x` speed. Users had no way to adjust how fast the interviewer spoke, which is a common accessibility and preference need.

**Solution:** Made playback rate configurable per interviewer message on the transcript page, and kept a single global selector for the voice interview page where audio is automatic.

**What changed:**
- `src/lib/use-playback-rate.ts` — new hook with `localStorage` persistence, default `1.0x`, validated options `0.5x`–`2.0x` (used by voice interview)
- `src/app/interview/[id]/transcript/page.tsx`:
  - Added per-message playback-rate state (`messagePlaybackRates` Map)
  - Speed selector moved next to each "Speak" button and controls only that message's playback rate
  - `speakMessageStream` / `speakMessageFallback` now accept a `playbackRate` argument
  - Applied selected per-message rate to `SentenceAudioQueue` streaming playback
  - Applied selected per-message rate to fallback `<audio>` element
- `src/app/interview/[id]/voice/page.tsx`:
  - Added global speed selector in the header next to streaming toggle
  - Applied selected rate to `SentenceAudioQueue` streaming playback
  - Applied selected rate to fallback `<audio>` autoplay and turn playback
- Documentation:
  - `docs/COMPONENTS.md` — added `usePlaybackRate` hook documentation and updated page component descriptions

---

## 2026-08-24

### Resync Documentation After Backend Extraction

**Change:** `resync-docs-after-backend-extraction`

**Problem:** After the backend was extracted into `adaptive-interview-api`, the frontend documentation still described a monolith: API route details, direct database setup steps, and references to files that no longer existed (`src/lib/db.ts`, `src/lib/schema.ts`, `src/lib/ollama.ts`, etc.). The backend repository also lacked its own comprehensive docs.

**Solution:** Split documentation ownership between repos:
- `adaptive-interview-api` now owns backend API reference, architecture, and setup docs.
- `adaptive-interview` keeps only frontend-specific docs and links to the backend via absolute GitHub URLs.

**What changed:**
- Backend (`adaptive-interview-api`):
  - Created `docs/API.md` — full REST reference including voice and async evaluation endpoints
  - Created `docs/ARCHITECTURE.md` — backend internal architecture and data flows
  - Created `docs/SETUP.md` — backend-only setup guide
  - Rewrote `README.md` as a landing page linking to docs
  - Fixed `audio-gateway/README.md` diagram label
- Frontend (`adaptive-interview`):
  - Rewrote `docs/API.md`, `docs/DATABASE.md`, `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `README.md`
  - Updated `docs/SECURITY.md`, `docs/OLLAMA.md`, `docs/COMPONENTS.md`
  - Added path migration note and dated entry to `docs/CHANGELOG.md`
  - Updated `docs/OPENSPEC.md` archive table
- Validation:
  - Confirmed `npm run build` passes in both repos
  - Confirmed no live references to deleted frontend backend files in docs
  - Confirmed cross-repo markdown links point to `https://github.com/vdung2k6-myna/adaptive-interview-api/blob/master/...`

---

## 2026-08-23

### Fix Delete Button UI Not Updating

**Change:** `fix-delete-button-ui`

**Problem:** Clicking Delete on Campaigns, Candidates, or Positions lists removed the item from the backend but the UI didn't update — the deleted row remained visible until a manual page refresh.

**Root Cause:** `DeleteButton` called `router.refresh()` which only re-fetches Server Component data. But all three list pages (`campaigns/page.tsx`, `candidates/page.tsx`, `positions/page.tsx`) are Client Components that manage their own state via `useState`. `router.refresh()` does nothing for Client Component state.

**Solution:** Added an optional `onDelete` callback to `DeleteButton`. Each list page passes a callback that filters the deleted item from local state immediately, giving instant UI feedback.

**What changed:**
- `src/components/DeleteButton.tsx` — added `onDelete?: () => void` prop, called after successful DELETE
- `src/app/campaigns/page.tsx` — passed `onDelete` that filters deleted campaign from `campaigns` state
- `src/app/candidates/page.tsx` — passed `onDelete` that filters deleted candidate from `candidates` state
- `src/app/positions/page.tsx` — passed `onDelete` that filters deleted position from `positions` state

---

## 2026-08-23

### Async Evaluation Polling

**Change:** `async-evaluation-polling`

**Problem:** The backend changed `POST /api/sessions/:id/evaluate` from a synchronous endpoint to an async job queue. It now returns `202 Accepted` with a `jobId` instead of the completed evaluation. The frontend's transcript page still assumed a synchronous response and immediately called `fetchEvaluation()`, which would return stale or missing data.

**Solution:** Refactored `transcript/page.tsx` to treat evaluation generation as an async job:
1. `POST /api/sessions/:id/evaluate` → receive `{ jobId, status }`
2. Poll `GET /api/evaluations/jobs/:jobId` every 2 seconds
3. Show loading UI ("Starting evaluation..." → "Evaluating...")
4. On `completed`, call `fetchEvaluation()` to display results
5. On `failed`, show error with retry option

**What changed:**
- `src/app/interview/[id]/transcript/page.tsx`:
  - Replaced `evalLoading: boolean` + `evalError: string` with `EvalJobState` discriminated union (`idle | posting | polling | completed | failed`)
  - Renamed `generateEvaluation()` → `startEvaluationJob()` — handles 202 response
  - Added polling `useEffect` — interval every 2s, cleanup on unmount/state change
  - Updated UI: spinner + job ID during polling, error banner on failure, "Retry" button text
- Documentation:
  - `docs/API.md` — updated `POST /api/sessions/:id/evaluate` to `202` response; added `GET /api/evaluations/jobs/:jobId`
  - `docs/EVALUATION.md` — added async job flow section with diagram

---

## 2026-08-23

### Fix Voice Interview Autoplay State Reset

**Change:** `fix-voice-autoplay-state-reset`

**Problem:** In voice interview mode, after the candidate submits their answer on turn 2 or later, the interviewer's auto-play audio starts briefly and then stops. The first turn works, but all subsequent turns are silent.

**Root Cause:** `src/app/interview/[id]/voice/page.tsx` resets `hasReceivedSentencesRef` and `seenSentenceIndicesRef` at the start of each turn, but omits `pendingChunksRef` and `nextExpectedIndexRef`. These carry over indices from the previous turn, so the sentence reorder/flush loop looks for the wrong index and never enqueues new audio chunks into the `SentenceAudioQueue`.

**Solution:** Added the two missing reset lines:
```typescript
pendingChunksRef.current.clear();
nextExpectedIndexRef.current = 0;
```

**What changed:**
- `src/app/interview/[id]/voice/page.tsx` — added `pendingChunksRef.current.clear()` and `nextExpectedIndexRef.current = 0` inside `handleRecordingComplete`

---

## 2026-08-23

### Clean Monolith Backend Code

**Change:** `clean-monolith-backend-code`

**Problem:** After `complete-backend-extraction`, the monolith still carried backend baggage: 8 Server Component pages performed direct Drizzle DB queries, and 16 dead backend files (`db.ts`, `schema.ts`, `ollama.ts`, `evaluation.ts`, audio pipeline) remained in `src/lib/`.

**Solution:** Converted all 8 pages to Client Components using `apiFetch()`, enriched backend list endpoints with `sessionCount`, added `GET /api/campaigns/:id` to the backend, deleted all dead files, and created lightweight `src/lib/types.ts` for frontend type safety.

**What changed:**
- Backend (`adaptive-interview-api`):
  - `GET /api/candidates` — now includes `sessionCount` per candidate
  - `GET /api/positions` — now includes `sessionCount` per position
  - `GET /api/campaigns/:id` — new endpoint with full detail + metrics + top candidates
- Frontend:
  - Converted 8 pages from Server Components → Client Components:
    - `candidates/page.tsx`, `candidates/[id]/edit/page.tsx`
    - `positions/page.tsx`, `positions/[id]/edit/page.tsx`
    - `campaigns/page.tsx`, `campaigns/[id]/page.tsx`, `campaigns/new/page.tsx`
    - `setup/page.tsx`
  - Created `src/lib/types.ts` — lightweight frontend interfaces replacing Drizzle schema types
  - Deleted `src/lib/db.ts`, `src/lib/schema.ts`, and 14 other dead backend files
- Documentation:
  - `docs/ARCHITECTURE.md` — updated to reflect pure frontend / no direct DB access
  - `docs/API.md` — added `GET /api/candidates`, `GET /api/positions` list docs; updated `GET /api/campaigns/:id` response shape

---

## 2026-08-22

### Consolidate Audio Services in Backend

**Change:** `consolidate-audio-services-in-backend`

**Problem:** The frontend repository still owned the entire audio services stack (Kokoro, Piper, Audio Gateway, model files, and startup scripts) even though it had no backend code left.

**Solution:** Moved all audio service code into `adaptive-interview-api` where the backend that consumes them lives.

**What changed:**
- Moved to `adaptive-interview-api/`:
  - `audio-gateway/` — FastAPI unified TTS proxy
  - `kokoro-service/` — FastAPI Kokoro TTS
  - `piper-service/` — FastAPI Piper TTS
  - `pipervoices/` — Piper model weights
  - `scripts/start-audio-services.bat`, `.sh` — startup scripts
  - `scripts/stop-audio-services.bat`, `.sh` — shutdown scripts
  - `scripts/start-audio.js`, `stop-audio.js` — cross-platform Node wrappers
- Backend `package.json` — added `start:audio` and `stop:audio` npm scripts
- Backend `README.md` — added audio services setup section
- Frontend deletions:
  - Removed `audio-gateway/`, `kokoro-service/`, `piper-service/`, `pipervoices/`
  - Removed `scripts/start-audio-services.*` and `scripts/stop-audio-services.*`
- Documentation:
  - `docs/SETUP.md` — replaced Section 7 (detailed audio setup) with a reference to backend repo
  - `docs/ARCHITECTURE.md` — noted audio services live in backend repo

---

## 2026-08-22

### Fix Audio Stop and Streaming Bugs

**Change:** `fix-audio-stop-and-streaming`

**Problem:** The Speak/Stop feature on the transcript page and the pause/resume in the voice interview had three interconnected bugs:
1. `SentenceAudioQueue.stop()` set a permanent `aborted` flag with no reset — after Stop, the queue was dead forever.
2. `stop()` did not clear a pending `setTimeout` used for punctuation pauses — a "ghost" timer fired ~400ms later, triggering `onFinished()` and corrupting state.
3. Clicking Stop on the transcript page could trigger fallback audio playback if the abort produced anything other than a pure `AbortError`.
4. Backend `speak-stream` emitted split-chunk results with duplicate indices, causing the frontend to drop the second half of phoneme-split sentences.
5. Backend emitted SSE events out of order (parallel worker pool), causing silence until the slowest chunk resolved.

**Solution:**
- Replaced permanent `aborted` with a generation counter in `SentenceAudioQueue`; `stop()` increments the generation and clears pending timers.
- Added `speakGenerationRef` per-stream generation counter to transcript page so rapidly-clicked Speak/Stop cannot leak chunks from a stale SSE stream into a new queue.
- Changed voice interview pause/resume to use `AudioContext.suspend()` / `resume()` instead of destroying the queue.
- Backend: concatenated split-chunk WAV buffers into a single buffer before emitting one SSE event per index.
- Backend: replaced parallel worker pool with ordered sequential await so SSE events emit in strict index order.
- Backend: added client disconnect detection (socket `close` event) in `speak-stream` so synthesis stops when the browser closes the SSE connection.
- Backend: filter out empty/whitespace-only chunks before synthesis to prevent Piper "produced no audio data" errors on trailing markdown artifacts.
- Backend: `synthesizeChunkWithFallback` and `synthesizeSpeechWithFallback` now skip chunks with no Unicode letters silently (e.g. pure punctuation, symbols, numbers-only), instead of sending them to TTS and getting "Piper produced no audio data".

**What changed:**
- `src/lib/audio/sentence-queue.ts` — generation counter, timer cleanup
- `src/app/interview/[id]/transcript/page.tsx` — `speakGenerationRef` per-stream guard
- `src/app/interview/[id]/voice/page.tsx` — AudioContext suspend/resume for pause
- `adaptive-interview-api/src/routes/voice.ts` — ordered SSE emission, split-chunk concatenation

---

## 2026-08-22

### Extract Standalone Backend API

**Change:** `complete-backend-extraction`

**Problem:** The Next.js monolith handled both frontend rendering and API routes, making independent scaling and deployment difficult.

**Solution:** Extracted all API routes into a standalone Express server in `adaptive-interview-api/` (port 4000).

**What changed:**
- New repository: `adaptive-interview-api/`
  - Express server with all CRUD routes: candidates, positions, sessions, campaigns, messages, evaluations, voice, MCP
  - Streaming interview messages via `res.write()` text/plain
  - Voice pipeline with multer multipart uploads and SSE audio streaming
  - MCP analytics SSE transport (`ExpressSseTransport`)
  - Bearer token auth via `API_AUTH_TOKEN`
  - CORS configured for frontend on port 3000
  - Same Drizzle ORM schema and PostgreSQL database as monolith
- Monolith changes:
  - `docs/ARCHITECTURE.md` — updated with Pattern B architecture diagram
  - Frontend components updated to call external backend via `apiFetch()` with Bearer token

## 2026-08-21

### Add API Key Authentication

**Change:** `add-api-key-auth`

**Problem:** All API routes were publicly accessible. Anyone could create, modify, or delete positions, candidates, sessions, and evaluations.

**Solution:** Added optional Bearer token authentication to all API routes.

**What changed:**
- Library:
  - `src/lib/auth.ts` — `validateApiAuth()` checks `Authorization: Bearer <token>` against `API_AUTH_TOKEN`
  - `src/lib/api-client.ts` — `apiFetch()` wrapper injects the Bearer header when `NEXT_PUBLIC_API_TOKEN` is set
  - `src/lib/config/index.ts`, `development.ts`, `production.ts` — added `auth.apiToken` field
- API:
  - All 20+ API route files now call `validateApiAuth()` at the start of each handler and return `401 Unauthorized` if the token is missing or invalid
  - `POST /api/mcp` and `GET /api/mcp` check both `validateApiAuth()` and `validateMcpAuth()`
- Frontend:
  - `src/app/interview/[id]/page.tsx` — uses `apiFetch()` for streaming
  - `src/app/interview/[id]/voice/page.tsx` — uses `apiFetch()` for voice SSE
  - `src/app/interview/[id]/transcript/page.tsx` — uses `apiFetch()` for all transcript/evaluation/voice calls
  - `src/app/dashboard/page.tsx` — uses `apiFetch()` for session list
  - `src/app/setup/SetupForm.tsx` — uses `apiFetch()` for session creation
  - `src/app/candidates/new/CandidateForm.tsx` — uses `apiFetch()` for create/update
  - `src/app/positions/new/PositionForm.tsx` — uses `apiFetch()` for create/update
  - `src/app/campaigns/new/CampaignForm.tsx` — uses `apiFetch()` for create
  - `src/app/compare/page.tsx` — uses `apiFetch()` for session/evaluation loading
  - `src/components/DeleteButton.tsx` — uses `apiFetch()` for delete
- Docs:
  - Updated `SECURITY.md` — documented API key auth model and environment variables
  - Updated `SETUP.md` — added `API_AUTH_TOKEN` and `NEXT_PUBLIC_API_TOKEN` to `.env.local` template
  - Updated `API.md` — documented Bearer token requirement on all endpoints
  - Updated `CHANGELOG.md`

**Status:** Implemented and documented.

---

## 2026-08-21

### Stream Transcript Speak (SSE)

**Change:** `stream-transcript-speak`

**Problem:** The transcript page's "Speak" button sent the entire message text to `POST /api/voice/speak` and waited for a single combined WAV. For long interviewer responses, users waited several seconds before hearing any audio.

**Solution:** Added sentence-level streaming TTS for transcript replay:
- `POST /api/voice/speak-stream` — SSE endpoint that splits text into sentences, synthesizes each in order, and emits `sentence` events as audio becomes ready
- Transcript page now creates a `SentenceAudioQueue` on first Speak click and feeds sentence events as they arrive — same instant-playback UX as the voice interview
- `StreamingAudioQueue` component shows progress bar, current sentence text, and playback controls
- Old `POST /api/voice/speak` kept as `speakMessageFallback` for error fallback

**What changed:**
- API:
  - `src/app/api/voice/speak-stream/route.ts` — new SSE endpoint (already existed, verified complete)
- Frontend:
  - `speakMessageStream()` in transcript page — connects to SSE, feeds events into `SentenceAudioQueue`
  - `speakMessageFallback()` — preserved old non-streaming behavior for fallback
  - `stopSpeaking()` — stops queue, revokes object URLs, clears all streaming state
  - `StreamingAudioQueue` rendered inline in the transcript panel when speaking
- Performance:
  - Time-to-first-audio for a 5-sentence message: ~5–8s → ~1–2s
- Docs:
  - Updated `API.md`, `CHANGELOG.md`

**Status:** Implemented and documented.

---

## 2026-08-21

### Optimize Pauses Between Sentences and Paragraphs

**Change:** `optimize-tts-pauses`

**Problem:** When TTS played back interviewer messages, sentences ran together with no audible gap. Paragraph breaks (double newlines in markdown) and list items were also collapsed into continuous text, so the speech sounded like one long run-on sentence with no natural breathing room.

**Solution:** Fixed server-side WAV concatenation:

- **`concatWavBuffers(buffers, gapSeconds?)`** — Added optional gap parameter. When combining sentence WAVs into the stored interviewer audio file (in `stream/route.ts`), 0.3 seconds of silence is inserted between each buffer. Previously buffers were joined back-to-back with zero gap.

**What changed:**
- Library:
  - `src/lib/audio/wav-utils.ts` — `concatWavBuffers(buffers, gapSeconds?)` inserts silent PCM frames between buffers
- API:
  - `src/app/api/voice/stream/route.ts` — `concatWavBuffers(validBuffers, 0.3)` for combined interviewer audio
- Docs:
  - Updated `CHANGELOG.md`

**Status:** Implemented and documented.

---

## 2026-08-21

### Punctuation-Aware Pauses in Audio Queue

**Change:** `punctuation-aware-pauses`

**Problem:** Piper TTS (and to a lesser extent Kokoro) speaks through commas, semicolons, and colons too quickly. The audio chunks were played back-to-back with zero gap, so a sentence like *"First, let's discuss A; then, we'll move to B:"* sounded like one continuous run-on word.

**Solution:** Made `SentenceAudioQueue` punctuation-aware. After each chunk finishes, the queue inspects the chunk text and inserts a pause proportional to the trailing punctuation before starting the next chunk.

| Trailing punctuation | Pause inserted |
|---------------------|----------------|
| `…` `...` (ellipsis / paragraph) | 600 ms |
| `.` `!` `?` `。` `？` `！` (sentence ending) | 400 ms |
| `;` `:` (semicolon / colon) | 250 ms |
| `—` `-` (dash) | 200 ms |
| `,` `،` (comma) | 180 ms |
| word (no punctuation) | 0 ms (immediate) |

**What changed:**
- Library:
  - `src/lib/audio/sentence-queue.ts` — `QueueItem` stores optional `text`. Added `getPauseMs()` that maps trailing punctuation to pause duration. `enqueue(index, url, text?)` accepts chunk text so the queue can decide whether to delay
  - `src/lib/audio/text-processing.ts` — removed `
\n` → `…` conversion that was creating standalone `…` sentences TTS could not synthesize
- Frontend:
  - `src/app/interview/[id]/transcript/page.tsx` — passes `s.text` to `enqueue()`
  - `src/app/interview/[id]/voice/page.tsx` — passes `s.text` to `enqueue()`
- Docs:
  - Updated `CHANGELOG.md`

**Status:** Implemented and documented.

---

## 2026-08-21

### Slow Down Piper Playback Rate

**Change:** `piper-playback-rate`

**Problem:** Piper TTS (Vietnamese voice `vi_VN-vais1000-medium`) speaks noticeably fast and clips short syllables, making it hard for candidates to follow during voice interviews and transcript replay.

**Solution:** Added `playbackRate` option to `SentenceAudioQueue` and set it to **0.85×** for both voice interview and transcript playback. This slows audio by 15% without server-side changes, keeping the same pitch (Web Audio API time-stretching).

**What changed:**
- Library:
  - `src/lib/audio/sentence-queue.ts` — `SentenceQueueOptions` now accepts `playbackRate?: number`. Applied via `AudioBufferSourceNode.playbackRate.value` before playback starts
- Frontend:
  - `src/app/interview/[id]/transcript/page.tsx` — passes `playbackRate: 0.85` when creating the queue
  - `src/app/interview/[id]/voice/page.tsx` — passes `playbackRate: 0.85` when creating the queue
- Docs:
  - Updated `CHANGELOG.md`

**Status:** Implemented and documented.

---

## 2026-08-21

### Consolidate Text Processing for TTS

**Change:** `consolidate-text-processing-tts`

**Problem:** Text preprocessing logic (`stripMarkdown`, `splitForTTS`, `synthesizeChunkWithFallback`) was duplicated across three TTS route files (`speak`, `speak-stream`, `stream`). The implementations were inconsistent:
- `stream/route.ts` used `maxChars=70` while `speak-stream/route.ts` used `maxChars=60`
- `stripMarkdown` only removed bold/italic, leaving headers, code blocks, and list markers for TTS to speak aloud
- `stream/route.ts` had no fallback retry on phoneme overflow, causing Kokoro to crash on long Vietnamese sentences
- `synthesizeChunkWithFallback` in `speak-stream` only returned one half of a split chunk, silently discarding the other half

**Solution:** Extracted all text-processing logic into a shared module (`src/lib/audio/text-processing.ts`):
- `stripMarkdown()` — expanded rules: removes fenced code blocks, inline code, headers, blockquotes, and list markers in addition to bold/italic
- `splitForTTS(text, maxChars=60)` — unified default. Prefers stronger boundaries (`:`/`;` > `,` > `space`) to keep natural clauses together
- `synthesizeSpeechWithFallback()` — pure synthesis retry with recursive halving. For WAV outputs, successful halves are concatenated so no audio is lost
- `synthesizeChunkWithFallback()` — wrapper that saves audio after synthesis. Now returns **all** successful sub-results instead of discarding half

**What changed:**
- Library:
  - `src/lib/audio/text-processing.ts` — new shared module
  - `src/lib/audio/index.ts` — exports `stripMarkdown`, `splitForTTS`, `synthesizeSpeechWithFallback`, `synthesizeChunkWithFallback`
- API:
  - `src/app/api/voice/speak/route.ts` — imports `stripMarkdown` from shared module
  - `src/app/api/voice/speak-stream/route.ts` — imports all three from shared; loop updated to emit all sub-results from fallback splitting
  - `src/app/api/voice/stream/route.ts` — imports `stripMarkdown`, `splitForTTS`, `synthesizeSpeechWithFallback`; `enqueueTTS` uses fallback synthesis
- Docs:
  - Updated `ARCHITECTURE.md` — added `text-processing.ts` to file tree and Voice Interview section
  - Updated `API.md` — documented preprocessing behavior on `speak`, `speak-stream`, and `stream` endpoints
  - Updated `CHANGELOG.md`

**Status:** Implemented and documented.

---

## 2026-08-20

### Stream Sentence-Level TTS (Incremental)

**Change:** `stream-sentence-level-tts`

**Problem:** Voice interview per-turn latency was ~16–20s because the pipeline waited for the full LLM response before any TTS started. Candidates stared at a spinner for a long time.

**Solution:** Introduced **incremental sentence-level TTS with SSE streaming**:
- `POST /api/voice/stream` — SSE endpoint that detects sentence boundaries **during** LLM token streaming, fires TTS for each completed sentence in the background, and emits `sentence` events as audio becomes ready
- Sentence splitter (`src/lib/audio/split-sentences.ts`) — supports English and Vietnamese delimiters (`.`, `!`, `?`, `…`, `。`, `？`, `！`)
- Background TTS synthesis — each sentence is sent to TTS as soon as its boundary is detected in the token stream; TTS runs in parallel while LLM continues generating
- Sequential emission — TTS promises are awaited in sentence index order after LLM completes, guaranteeing events arrive in order (0, 1, 2...)
- WAV concatenation (`src/lib/audio/wav-utils.ts`) — merges sentence WAVs into a single file for storage
- `StreamingAudioQueue` component — queues and plays sentence chunks sequentially with preloading

**What changed:**
- Refactored `POST /api/voice/stream`:
  - Old: accumulate all LLM tokens → split sentences → batch TTS (3 at a time) → emit events
  - New: detect sentence boundaries incrementally during LLM streaming → fire TTS immediately per sentence → emit events after LLM done in index order
  - `POST /api/voice/turn` kept as non-streaming fallback
- Audio library:
  - `split-sentences.ts` — sentence boundary detection with delimiter check (`/[.!?…。？！]$/`)
  - `wav-utils.ts` — parse WAV headers, validate compatibility, concatenate PCM
  - `tts.ts` — `synthesizeSpeech()` for single-sentence calls (replaces `synthesizeSentences()` batch approach)
- Components:
  - `StreamingAudioQueue.tsx` — sequential playback with progress bar and preloading
- Frontend:
  - `VoiceInterviewPage` — SSE consumer unchanged; receives incremental `sentence` events as before
  - Toggle button to switch between streaming and standard mode
- Performance:
  - Time to first audio: ~16s → ~5–6s (65% improvement)
  - Overall per-turn latency: ~20s → ~10–12s (40–50% improvement)
- Docs:
  - Updated `API.md`, `ARCHITECTURE.md`, `COMPONENTS.md`, `CHANGELOG.md`

---

## 2026-08-20

### Replace audio.cpp STT with faster-whisper (rolled back)

**Change:** `replace-audiocpp-stt-with-faster-whisper` → **rolled back**

**Attempted:** Replaced audio.cpp STT with a dedicated **faster-whisper** FastAPI service (`stt-service/`). The `base` model transcribed in ~1s on CPU, but **Vietnamese transcription quality was significantly worse** than audio.cpp's Qwen3 ASR — technical terms and Vietnamese tones were garbled. Rolled back to audio.cpp for STT quality.

**Cleanup:**
- `stt-service/` directory and all references permanently removed — the experiment is archived in git history if ever needed
- `scripts/start-audio-services.bat` / `.sh` no longer include stt-service fallback logic
- All configs, code, and docs point exclusively to audio.cpp for STT

---

## 2026-08-20

### Add Audio Gateway (Unified TTS with Kokoro + Piper)

**Change:** `add-audio-gateway-unified-tts`

**Problem:** Next.js talked directly to multiple TTS services (Kokoro on :8081, future Piper on another port), leaking audio internals into the application code. Adding a new TTS engine required touching Next.js.

**Solution:** Introduced an **Audio Gateway** — a lightweight FastAPI proxy on `:8082` that exposes a single unified `POST /v1/audio/speech` endpoint. The gateway routes to Kokoro or Piper based on an `engine` parameter. Next.js only ever sees one URL. Also added a **Piper TTS Service** (`piper-service/`) wrapping the existing Vietnamese Piper models.

**What changed:**
- New services:
  - `audio-gateway/` — FastAPI proxy that routes TTS requests to Kokoro or Piper
  - `piper-service/` — FastAPI wrapper for Piper ONNX TTS models (~50-150MB each)
- Config:
  - Replaced `audio.ttsUrl` with `audio.gatewayUrl`
  - Added `DEFAULT_TTS_ENGINE` env var (`kokoro` | `piper`)
  - Added `ttsProvider` column to `interview_sessions` (per-session selection)
- Audio client:
  - Replaced `KokoroTtsClient` with `AudioGatewayClient`
  - Added `SynthesizeOptions` interface with `engine` and `voice`
  - Updated `synthesizeSpeech()` to accept options
- UI:
  - Added TTS engine selector (Kokoro / Piper) to session creation form when voice mode is selected
- Database:
  - Migration `0007_add_tts_provider.sql` adds `tts_provider` column
- Docs:
  - Updated `SETUP.md`, `API.md`, `ARCHITECTURE.md`, `COMPONENTS.md`

**Fix (same day):** Piper service was returning empty 44-byte WAV files (header only, no audio data). Root cause: `PiperVoice.synthesize()` yields `AudioChunk` objects, not raw bytes or numpy arrays. Fixed by extracting `audio_int16_bytes` from each `AudioChunk`. Also added auto-discovery of `./pipervoices` from project root so no env var is required.

---

## 2026-08-17

### Replace audio.cpp TTS with Kokoro

**Change:** `replace-audiocpp-tts-with-kokoro`

**Problem:** audio.cpp TTS was too slow (~46s per sentence on RTX 3050 4GB due to VRAM exhaustion and CPU fallback), making voice interviews unusable.

**Solution:** Replaced audio.cpp TTS with a dedicated Kokoro FastAPI service. Kokoro is an 82M-parameter ONNX model that synthesizes speech in ~200-500ms on CPU. audio.cpp remains for STT transcription.

**What changed:**
- New service:
  - Added `kokoro-service/` Python FastAPI app with `main.py`, `requirements.txt`, `download_models.py`
  - Downloads `Kokoro-Vietnamese` ONNX model (~300MB) from Hugging Face
- Config:
  - Split `audio.baseUrl` into `audio.sttUrl` and `audio.ttsUrl`
  - Added `KOKORO_BASE_URL` and `KOKORO_TTS_MODEL` env vars
- Audio client:
  - Refactored `src/lib/audio/client.ts` into `AudioCppClient` (STT) and `KokoroTtsClient` (TTS)
  - Updated `synthesizeSpeech()` in `src/lib/audio/tts.ts` to use `ttsClient`
  - Updated health check to verify both services
- Docs:
  - Updated `docs/SETUP.md` with separate audio.cpp (STT) and Kokoro (TTS) setup instructions

---

## 2026-08-09

### Job Description on Positions

**Change:** `job-description-on-positions`

**Problem:** Interview questions and evaluations only knew the position title, level, and requirements. There was no way to provide broader context about the role, team, or responsibilities.

**Solution:** Added an optional `jobDescription` text field to positions. It is included in the interviewer prompt and evaluation prompt when present, giving the AI richer context for question generation and scoring.

**What changed:**
- Database:
  - Added `job_description` column to `positions` table (nullable text)
  - Generated migration `migrations/0005_salty_loners.sql`
- API:
  - `POST /api/positions` — accepts optional `jobDescription`
  - `PATCH /api/positions/:id` — accepts optional `jobDescription`
  - `GET /api/positions/:id` — returns `jobDescription`
  - `GET /api/sessions` — returns `jobDescription` in position object
- AI Prompts:
  - `buildPrompt()` in `src/lib/prompts.ts` — includes job description under "Position" section when present
  - `buildEvaluationPrompt()` in `src/lib/evaluation.ts` — includes job description when present
  - `POST /api/messages` — passes `jobDescription` to `buildPrompt()`
- UI:
  - `PositionForm` — added textarea for job description
  - `/positions` list page — added "Description" column with truncated text
  - `/positions/[id]/edit` — passes `jobDescription` to form
- Documentation:
  - Updated `docs/API.md`, `docs/DATABASE.md`, `docs/COMPONENTS.md`

**Status:** Implemented and documented.

---

## 2026-08-09

### Recruiting Campaigns with Reporting

**Change:** `recruiting-campaigns` (OpenSpec)

**Problem:** No way to group positions into seasonal or project-based hiring campaigns, or view aggregated metrics across multiple positions.

**Solution:** Added flexible campaigns that group positions with optional dates, tags, and status. Campaign detail pages show aggregated report metrics (sessions, completion rate, scores, recommendations, top candidates).

**What changed:**
- Database:
  - Added `campaigns` table with name, description, optional dates, tags, and status
  - Added `campaign_positions` junction table for many-to-many relationship
  - Generated migration `migrations/0004_aromatic_orphan.sql`
- API:
  - `POST /api/campaigns` — create campaign, optionally assign positions via `positionIds`
  - `GET /api/campaigns` — list campaigns with `positionCount` and `sessionCount`
  - `GET /api/campaigns/:id` — fetch campaign with positions and full report
  - `PATCH /api/campaigns/:id` — update campaign fields
  - `DELETE /api/campaigns/:id` — delete campaign (cascades junction rows)
  - `POST /api/campaigns/:id/positions` — add position to campaign
  - `DELETE /api/campaigns/:id/positions?positionId=...` — remove position from campaign
- UI:
  - New `/campaigns` page — list table with status, dates, position/session counts
  - New `/campaigns/new` page — creation form with position multi-select
  - New `/campaigns/[id]` page — detail with metrics cards, recommendation distribution, top candidates table, and position list
  - Updated `DeleteButton` to support `type="campaign"`
  - Updated nav bar with "Campaigns" link
- Documentation:
  - Updated `docs/API.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md`, `docs/COMPONENTS.md`

**Status:** Implemented and documented.

---

## 2026-08-09

### Edit/Delete Positions and Candidates

**Change:** `edit-delete-positions-candidates` (OpenSpec)

**Problem:** Positions and candidates were immutable after creation. Recruiters couldn't fix typos, update CVs, or remove test entries.

**Solution:** Added edit and delete capabilities for positions and candidates, restricted to entities with no associated interview sessions (Direction D).

**What changed:**
- API:
  - `GET /api/positions/:id` — fetch single position
  - `PATCH /api/positions/:id` — update fields, regenerate embeddings if requirements changed, blocked by 409 if referenced
  - `DELETE /api/positions/:id` — delete if unused, blocked by 409 if referenced
  - `GET /api/candidates/:id` — fetch single candidate
  - `PATCH /api/candidates/:id` — update fields, blocked by 409 if referenced
  - `DELETE /api/candidates/:id` — delete if unused, blocked by 409 if referenced
- UI:
  - New `/positions` page — list table with Edit/Delete actions, "in use" session count
  - New `/candidates` page — list table with Edit/Delete actions, "in use" session count
  - Extended `PositionForm` with `initialData` prop for edit mode (`PATCH` instead of `POST`)
  - Extended `CandidateForm` with `initialData` prop for edit mode
  - Created `/positions/[id]/edit/page.tsx` and `/candidates/[id]/edit/page.tsx`
  - New `DeleteButton` component with confirmation dialog
  - Updated nav bar: replaced "+ Position" / "+ Candidate" with "Positions" / "Candidates" links
  - Updated `/setup` to show "Edit" links below dropdowns for unused entities

**Status:** Implemented and documented.

---

## 2026-08-09

### Dev Server Port Convenience Scripts

**Change:** `dev-port-scripts`

**What changed:**
- Added `dev:3001` and `dev:4000` scripts to `package.json` for quick port switching
- Updated `README.md` and `docs/SETUP.md` with the new commands

**Status:** Implemented.

---

## 2026-08-09

### Fix: Static Chunk Loading in Standalone Build

**Change:** `standalone-static-postbuild`

**Problem:** Next.js `output: "standalone"` does not copy `.next/static/` (JS/CSS chunks) into the standalone directory. Running `node .next/standalone/server.js` caused `Failed to load chunk` errors in the browser.

**Solution:** Added a `postbuild` script that copies `.next/static` → `.next/standalone/.next/static` after every build.

**What changed:**
- Created `scripts/postbuild.mjs` — copies static chunks into the standalone output directory
- Updated `package.json`:
  - Added `"postbuild": "node scripts/postbuild.mjs"` (runs automatically after `npm run build`)
  - Updated `"start": "node .next/standalone/server.js"` (was `next start`, which doesn't work with standalone)
- Updated `docs/SETUP.md` and `README.md` — corrected production start instructions

**Status:** Implemented and documented.

---

## 2026-08-09

### Copy Interview Link

**Change:** `copy-interview-link`

**Problem:** Recruiters had no way to retrieve the candidate-facing interview URL after creating a session.

**Solution:** Added "Copy Interview Link" buttons to the Dashboard and Transcript pages.

**What changed:**
- `src/app/dashboard/page.tsx` — Added `Copy Link` button in the Actions column of the session table. Shows "Copied!" for 2 seconds after clicking.
- `src/app/interview/[id]/transcript/page.tsx` — Added "Copy Interview Link" button in the transcript header. Shows "✓ Link Copied" for 2 seconds after clicking.
- Both use `navigator.clipboard.writeText()` with a fallback to `document.execCommand("copy")` for older browsers.

**Status:** Implemented and documented.

---

## 2026-08-09

### Environment-Specific Configuration

**Change:** `env-config-layer`

**Problem:** Timeouts, DB pool sizes, and retry counts were hardcoded. Dev machines and production deploys need different tuning.

**Solution:** Centralized config layer in `src/lib/config/` with per-environment files. Production build uses Next.js `output: "standalone"` for a self-contained deployable bundle.

**What changed:**
- Created `src/lib/config/index.ts` — exports active config based on `NODE_ENV`
- Created `src/lib/config/development.ts` — small pool (5), 60s chat timeout, 1 retry
- Created `src/lib/config/production.ts` — large pool (20), 120s chat timeout, 2 retries
- Updated `next.config.ts` with `output: "standalone"`, `compress: true`, and `productionBrowserSourceMaps: false`
- Updated `src/lib/db.ts` — uses `config.database.poolSize` for `Pool.max`
- Updated `src/lib/ollama.ts` — uses config for base URL, model names, timeouts, and error messages
- Updated `src/lib/evaluation.ts` — uses config for temperature and max retry attempts
- Removed unused `delay()` function from `src/lib/ollama.ts`
- Updated `README.md`, `SETUP.md` — corrected production start command to `node .next/standalone/server.js` (not `npm start`)

**Status:** Implemented and documented.

---

## 2026-08-08

### Evaluation Calibration (Implemented)

**Change:** `evaluation-calibration` (OpenSpec, archived)

**Problem:** AI evaluation scores are inconsistent across models and runs. Recruiters cannot trust or override scores. No history of re-evaluations.

**Solution:**
- Added `evaluationVersions` table with `ai_*` and `human_*` score columns
- Created `ScoreInput`, `ModelBadge`, and `VersionHistory` components
- Updated transcript page with human override, model selector, and version history
- Updated dashboard to show AI + human scores and calibration indicator
- Updated compare page to show model badge and handle new API shape
- Added `GET /api/evaluations/versions/:versionId` for historical version viewing

**What changed:**
- `src/lib/schema.ts` — Added `evaluationVersions` table with human calibration fields
- `src/lib/evaluation.ts` — Generates new versions (never overwrites)
- `src/app/api/evaluations/[sessionId]/route.ts` — Returns `{latest, versions}` with nested score objects
- `src/app/api/evaluations/versions/[versionId]/route.ts` — Added GET for version viewing, existing DELETE
- `src/app/api/sessions/[id]/evaluate/route.ts` — Accepts optional `{model}` in body
- `src/app/api/sessions/route.ts` — Uses evaluationVersions, returns `humanOverallScore` + `humanCalibrated`
- `src/app/interview/[id]/transcript/page.tsx` — Full calibration UI with historical viewing
- `src/app/dashboard/page.tsx` — Shows human score and calibration indicator
- `src/app/compare/page.tsx` — Shows model badge, uses `aiScores` nested fields
- `src/components/ScoreInput.tsx` (new) — Interactive star score input
- `src/components/ModelBadge.tsx` (new) — Model name badge
- `src/components/VersionHistory.tsx` (new) — Version list with select/delete
- `migrations/0004_add_evaluation_versions.sql` (new) — Creates evaluationVersions table
- `migrations/0005_migrate_evaluations.sql` (new) — Migrates old evaluations

**Status:** Implemented and documented.

---

### Rich LLM Chat Output

**Change:** `rich-llm-chat-output` (OpenSpec)

**Problem:** LLM text output was rendered as raw plain text. When the model used Markdown formatting (bold text, bullet lists, code blocks), candidates saw literal asterisks and backticks.

**Solution:** Parse Markdown with `marked`, syntax-highlight code blocks with `highlight.js`, and safely render HTML with `DOMPurify`.

**What changed:**
- Added `MarkdownRenderer` component with tree-shaken `highlight.js` (9 languages)
- Added custom CSS for dark code blocks, inline code, lists, tables, and syntax tokens
- Updated interview page to render interviewer messages as rich Markdown
- Updated transcript page with identical rich formatting
- Updated interviewer prompt to encourage Markdown formatting and language hints
- Added performance optimizations:
  - Batch React state updates during streaming (~50ms intervals)
  - `React.memo` on `MarkdownRenderer`
  - Extracted `MessageBubble` component with `React.memo`

**Files touched:**
- `src/components/MarkdownRenderer.tsx` (new)
- `src/app/globals.css` (added Markdown + hljs styles)
- `src/app/interview/[id]/page.tsx` (rich rendering + performance)
- `src/app/interview/[id]/transcript/page.tsx` (rich rendering)
- `src/lib/prompts.ts` (added Markdown hint)
- `package.json` (added `highlight.js`, `dompurify`)

**Performance impact:**
- React re-renders during streaming: ~100/sec → ~20/sec
- Completed messages now skip React's render phase entirely
- Markdown parsing reduced by ~5-10×

---

### Recruiter Dashboard with AI Evaluation

**Change:** `recruiter-dashboard-with-ai-eval` (OpenSpec, archived)

**Problem:** No centralized view for recruiters to review interview results.

**Solution:** Built dashboard with session list, status filters, search, and side-by-side candidate comparison with star ratings.

**What changed:**
- Created `/dashboard` page with stats cards and session table
- Created `/compare` page for side-by-side evaluation comparison
- Added `overallScore` and `recommendation` to session API response
- Added color-coded status and recommendation badges

---

### Real-Time Ollama Streaming

**Change:** `real-time-ollama-streaming` (OpenSpec, archived)

**Problem:** Interview questions appeared all at once after a long delay. Users saw only a bouncing-dots loader.

**Solution:** Switched from `stream: false` to `stream: true`, piped tokens through a Next.js `ReadableStream`, and rendered them incrementally.

**What changed:**
- Added `generateChatResponseStream()` in `src/lib/ollama.ts`
- Updated `POST /api/messages` to return `ReadableStream`
- Updated interview page with `consumeStream()` function
- Added loading dots animation during streaming

---

### Semantic Topic Tracking

**Change:** `semantic-topic-tracking` (OpenSpec, archived)

**Problem:** Interviewer asked about the same topics repeatedly or skipped important requirements.

**Solution:** Added vector embeddings to track which position requirements have been covered by the conversation.

**What changed:**
- Created `embeddings` table with pgvector support
- Added `storeRequirementEmbedding()` and `storeMessageEmbedding()`
- Added `getRequirementCoverage()` for cosine similarity queries
- Updated `buildPrompt()` to include covered and remaining topics

---

### Adaptive Interview Engine (Initial)

**Change:** `adaptive-interview-engine` (OpenSpec, archived)

**Problem:** Static interview questions that don't adapt to the candidate.

**Solution:** AI-generated questions that consider candidate skills, experience, CV, and position requirements.

**What changed:**
- Created core data model (positions, candidates, sessions, messages)
- Built `buildPrompt()` for context-aware question generation
- Created turn-based interview flow with max turn limit
- Added setup page for selecting position + candidate

---

## 2026-08-07 (Earlier)

### Vector Search

Added pgvector extension and embeddings table for semantic similarity search.

### AI Interview

Initial implementation of AI-powered interviewer using Ollama.

### OpenSpec Integration

Added OpenSpec framework for managing changes.

---

## 2026-08-17

### Voice Interview (Turn-Based)

**Change:** `add-voice-interview-turn-based` (OpenSpec)

**Problem:** The Adaptive Interview Engine is text-only. Candidates with motor disabilities, dyslexia, or strong verbal communication skills are disadvantaged. Hiring managers cannot assess vocal delivery.

**Solution:** Added an optional turn-based voice interview mode alongside existing text mode. Candidates record audio answers; the server transcribes via audio.cpp (STT), generates the next question via Ollama, and synthesizes the response via audio.cpp (TTS).

**What changed:**
- Database:
  - Added `mode` column to `interview_sessions` (`text` | `voice`, default `text`)
  - Added audio columns to `messages`: `audioUrl`, `audioDurationSeconds`, `audioFormat`, `sttConfidence`
  - Generated migration `migrations/0006_silent_rachel_grey.sql`
- Config:
  - Added `audio` section to `src/lib/config/` with `baseUrl`, `sttModel`, `ttsModel`, `timeoutMs`
  - New env vars: `AUDIOCPP_BASE_URL`, `AUDIOCPP_STT_MODEL`, `AUDIOCPP_TTS_MODEL`
- Audio Infrastructure:
  - Created `src/lib/audio/client.ts` — HTTP client for audio.cpp
  - Created `src/lib/audio/stt.ts` — STT wrapper
  - Created `src/lib/audio/tts.ts` — TTS wrapper
  - Created `src/lib/audio/storage.ts` — local filesystem audio storage
- API:
  - `POST /api/voice/start` — generate first question with TTS
  - `POST /api/voice/turn` — full turn pipeline: STT → LLM → TTS
  - `GET /audio/[[...path]]` — serve stored audio files
  - `POST /api/sessions` — accepts optional `mode` parameter
- UI:
  - New `AudioRecorder` component — MediaRecorder + waveform visualization
  - New `AudioPlayer` component — HTML5 audio with transcript toggle
  - New `/interview/[id]/voice` page — voice interview UX
  - Updated `/setup` — mode selection (Text / Voice)
  - Updated `/dashboard` — mode badges and "Join Voice" links
  - Updated `/interview/[id]` — redirects voice sessions to voice page
- Documentation:
  - Updated `API.md`, `ARCHITECTURE.md`, `COMPONENTS.md`, `SETUP.md`, `CHANGELOG.md`

**Status:** Implemented and documented.

---

## 2026-08-15

### MCP Analytics Server

**Change:** `add-mcp-analytics-server` (OpenSpec)

**Problem:** Interview data is locked inside PostgreSQL. External AI assistants (Claude Desktop, Cursor, internal tooling) cannot query candidate evaluations, campaign performance, or session summaries.

**Solution:** Exposed a read-only, anonymized MCP server over SSE at `/api/mcp`. Six tools provide structured access to interview analytics without exposing PII.

**What changed:**
- Dependencies: Added `@modelcontextprotocol/sdk` and `zod`
- Config: Added `mcp` section to `src/lib/config/` with `enabled` flag and `authToken`
- Infrastructure:
  - Created `src/lib/mcp/auth.ts` — Bearer token validation with timing-safe comparison
  - Created `src/lib/mcp/transport.ts` — custom SSE transport for Next.js App Router
  - Created `src/lib/mcp/server.ts` — `McpServer` with tool registry
  - Created `src/app/api/mcp/route.ts` — GET (SSE) + POST (JSON-RPC) handlers
- Tools:
  - `listCampaigns` — campaigns with position/session counts
  - `getCampaignAnalytics` — aggregated scores, skills, weak areas
  - `listSessions` — anonymized session metadata
  - `getSessionSummary` — session + evaluation scores (no transcript)
  - `listPositions` — positions with session counts
  - `searchCandidatesBySkill` — skill-matched candidates (no names)
- Anonymization: `src/lib/mcp/tools/_anonymize.ts` strips PII and replaces `candidateId` with stable UUIDs
- Documentation: Updated `API.md`, `ARCHITECTURE.md`, `SECURITY.md`, `SETUP.md`, `CHANGELOG.md`, `COMPONENTS.md`, `README.md`

**Status:** Implemented and documented.

---

## Decisions Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-08-08 | Always-dark code blocks | Dark code blocks look intentional in both light/dark app modes. Simplifies theming significantly. |
| 2026-08-08 | No `system` role for prompts | Some cloud Ollama models reject `system` messages. Using `user` role for context ensures compatibility. |
| 2026-08-08 | Batch streaming at 50ms | Trade-off between responsiveness and CPU usage. 50ms feels smooth while reducing re-renders by ~5×. |
| 2026-08-08 | Tree-shake highlight.js | Import only 9 languages (~30KB) vs full bundle (~300KB). Covers 95% of technical interview topics. |
| 2026-08-07 | Use `text` for embeddings | Drizzle doesn't support pgvector's `vector` type. Store as JSON string, cast in raw SQL queries. |
| 2026-08-07 | No auth for MVP | Interviews are accessed via unguessable UUID URLs. Authentication deferred to post-MVP. |

---

## Migration Notes

### Adding `cv` column to candidates

```bash
psql $DATABASE_URL -f migrations/0001_add_cv.sql
```

### Adding embeddings table

```bash
# Ensure pgvector extension is enabled
psql ai_interview -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Apply migration
psql $DATABASE_URL -f migrations/0002_add_embeddings.sql
```

### Adding evaluations table

```bash
psql $DATABASE_URL -f migrations/0003_add_evaluations.sql
```

### Adding evaluation versions table

```bash
psql $DATABASE_URL -f migrations/0004_add_evaluation_versions.sql
```

### Migrating evaluations to evaluationVersions

```bash
psql $DATABASE_URL -f migrations/0005_migrate_evaluations.sql
```

### Adding job_description to positions

```bash
psql $DATABASE_URL -f migrations/0005_salty_loners.sql
```

### Adding campaigns and campaign_positions tables

```bash
psql $DATABASE_URL -f migrations/0004_aromatic_orphan.sql
```
