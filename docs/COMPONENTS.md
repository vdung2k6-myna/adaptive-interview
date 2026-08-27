# Component Documentation

## Shared Components

### `MarkdownRenderer`

**Location:** `src/components/MarkdownRenderer.tsx`

Renders Markdown text with syntax-highlighted code blocks. Used for interviewer messages in both the live chat and transcript views.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `content` | `string` | Raw Markdown text to render |

**Features:**
- GitHub-flavored Markdown (tables, lists, code blocks, bold/italic)
- Syntax highlighting for 9 languages: JavaScript, TypeScript, Python, Go, Java, Rust, SQL, Bash, JSON
- Dark code blocks with VS Code Dark+ inspired token colors
- Inline code with subtle background
- HTML sanitization via `DOMPurify`
- Memoized with `React.memo` for performance

**Usage:**

```tsx
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

// In interviewer message bubble
<MarkdownRenderer content={msg.content} />
```

**Security:** `dangerouslySetInnerHTML` is safe because:
1. Source is a local Ollama model, not untrusted user input
2. `DOMPurify.sanitize()` strips scripts and dangerous tags
3. Only `class` attribute is allowed (for `hljs-*` classes)

**Performance:** Wrapped in `React.memo` — skips re-render when `content` prop hasn't changed.

---

### `ScoreInput`

**Location:** `src/components/ScoreInput.tsx`

Interactive star-based score input for human calibration.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Dimension label (e.g. "Technical Depth") |
| `value` | `number \| null` | Current score (1-5) or null |
| `onChange` | `(value: number \| null) => void` | Callback when score changes |
| `disabled` | `boolean` | Optional, disables interaction |

**Features:**
- Click a star to set score
- Click the same star again to clear
- Hover preview before clicking
- Yellow filled stars for selected, gray for empty
- Star touch targets are `h-10 w-10` on mobile and `sm:h-8 sm:w-8` on larger screens

---

### `ModelBadge`

**Location:** `src/components/ModelBadge.tsx`

Simple badge showing which Ollama model generated an evaluation.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `model` | `string` | Model name (e.g. "llama3.1") |

**Features:**
- 🤖 prefix icon
- Subtle gray background
- Memoized with `React.memo`

---

### `VersionHistory`

**Location:** `src/components/VersionHistory.tsx`

Lists all evaluation versions for a session with select and delete actions.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `versions` | `Version[]` | Array of evaluation versions |
| `currentVersionId` | `string` | ID of the currently displayed version |
| `onSelect` | `(versionId: string) => void` | Callback when a version is clicked |
| `onDelete` | `(versionId: string) => void` | Callback when delete × is clicked |

**Features:**
- Shows model badge, date, and calibration status for each version
- Current version highlighted
- Delete button on non-current versions
- Hidden when only one version exists

---

### `DeleteButton`

**Location:** `src/components/DeleteButton.tsx`

Client component for deleting positions or candidates with confirmation.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Entity UUID |
| `type` | `"position" \| "candidate" \| "campaign"` | Which endpoint to call |

**Features:**
- Confirmation dialog via `confirm()`
- Calls `DELETE /api/{type}s/{id}` via `apiFetch()` (injects Bearer token when auth is enabled)
- Refreshes the page via `router.refresh()` on success
- Shows alert on error
- Button touch target is `min-h-[44px] px-2` for mobile ease of use

---

### `MobileNav`

**Location:** `src/components/MobileNav.tsx`

**Type:** Client component ("use client")

**Responsibilities:**
- Render a hamburger button on small screens (`md:hidden`)
- Toggle a full-width dropdown menu with the same links as the desktop nav
- Close the menu when a link is clicked

**Features:**
- `aria-expanded` and `aria-controls` for accessibility
- `X` close icon when open, `☰` hamburger icon when closed
- Backdrop click / Escape handling is handled via internal state and click-outside behavior via the header layout

**Usage:**

```tsx
import { MobileNav } from "@/components/MobileNav";

// Inside layout header
<MobileNav />
```

---

### `AudioRecorder`

**Location:** `src/components/AudioRecorder.tsx`

**Type:** Client component ("use client")

**Responsibilities:**
- Capture microphone input via MediaRecorder API
- Visualize audio with live waveform (AudioContext + AnalyserNode)
- Record / Stop / Discard controls
- Emit recorded audio blob to parent

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `onRecordingComplete` | `(blob: Blob, durationMs: number) => void` | Callback with recorded audio |
| `onUserGesture` | `() => void` | Optional callback invoked on every recorder click (start/stop/submit) so the parent can keep a shared `AudioContext` unlocked for auto-play |
| `disabled` | `boolean` | Optional, disables recorder |

**Features:**
- Supports `audio/webm` with fallback to `audio/wav`
- Live waveform visualization (40 bars, updated via requestAnimationFrame)
- Timer display during recording
- Discard option before submitting
- Optional `onUserGesture` hook for auto-play coordination

---

### `AudioPlayer`

**Location:** `src/components/AudioPlayer.tsx`

**Type:** Client component ("use client")

**Responsibilities:**
- Play synthesized interviewer audio via HTML5 `<audio>`
- Custom play/pause/seek controls
- Transcript show/hide toggle
- Display role label (interviewer vs candidate)

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `audioUrl` | `string` | URL to audio file (served by `/audio/...`) |
| `transcript` | `string` | Text transcript of the audio |
| `role` | `"interviewer" \| "candidate"` | Determines styling and label |

**Features:**
- Seek bar with current time / duration display
- Auto-play support (triggered by parent VoiceInterviewPage)
- Transcript accordion (hidden by default)
- Rich Markdown rendering for interviewer transcripts (code blocks, lists, bold/italic)
- Plain pre-wrapped text for candidate transcripts
- "Audio unavailable" fallback when TTS fails

---

### `StreamingAudioQueue`

**Location:** `src/components/StreamingAudioQueue.tsx`

**Type:** Client component ("use client")

**Responsibilities:**
- Receive sentence-level audio chunks via SSE and play them sequentially
- Preload the next chunk while the current one plays for gapless transitions
- Show a progress bar indicating which sentence is playing
- Display the text of the currently playing sentence
- Handle playback errors by advancing to the next chunk

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `items` | `AudioQueueItem[]` | Array of `{ index, text, audioUrl }` chunks |
| `onFinished` | `() => void` | Callback when queue finishes playing |
| `autoPlay` | `boolean` | Start playing immediately when items arrive |

**Usage:**

```tsx
<StreamingAudioQueue
  items={streamItems}
  onFinished={() => console.log("All chunks played")}
  autoPlay={true}
/>
```

**Implementation Notes:**
- Uses two `<audio>` elements: one for current playback, one for preloading next
- Advances via `onEnded` event listener, not timer-based polling
- State updates are minimal: only `currentIndex` and `isPlaying` trigger re-renders

---

## Page Components

### `InterviewPage` (`interview/[id]/page.tsx`)

**Type:** Client component ("use client")

**Responsibilities:**
- Load interview session data
- Handle streaming Ollama responses
- Manage turn-based conversation flow
- Render chat UI with message bubbles
- Handle user input submission
- **Redirects voice sessions to `/interview/[id]/voice`**

**Key State:**

| State | Type | Purpose |
|-------|------|---------|
| `data` | `SessionData \| null` | Full session with messages |
| `loading` | `boolean` | Initial load state |
| `sending` | `boolean` | User submitted, waiting for response |
| `streaming` | `boolean` | Currently receiving stream tokens |
| `input` | `string` | Current user input value |

**Streaming Logic:**

```
User submits answer
    │
    ▼
Optimistically add candidate message to state
    │
    ▼
POST /api/messages (via apiFetch()) → Returns text/plain stream
    │
    ▼
consumeStream():
    - Accumulate chunks in streamingContentRef
    - Batch setData() every ~50ms (not every chunk)
    - Update message content incrementally
    - On completion: fetchSession() to get persisted data
```

**Note:** The stream is produced by the Express backend, not the Next.js frontend.

**Performance Optimizations:**
- `MessageBubble` extracted and wrapped in `React.memo`
- Only the streaming message re-renders; completed messages are skipped
- State updates batched to ~20/sec instead of ~100/sec

**Mobile:**
- Header stacks vertically on small screens (`flex-col sm:flex-row`)
- Chat input uses `text-base` and `min-h-[44px]` to prevent iOS Safari auto-zoom
- Send button is `text-base` / `min-h-[44px]` for easy touch interaction

---

### `VoiceInterviewPage` (`interview/[id]/voice/page.tsx`)

**Type:** Client component ("use client")

**Responsibilities:**
- Load voice interview session data via `apiFetch()`
- Generate first question via `POST /api/voice/start` (apiFetch)
- Auto-play the first question immediately after the user clicks "Start Interview"
- Render `AudioPlayer` for each completed interviewer message
- Render `AudioRecorder` for candidate turns
- Show processing states between turns
- **Streaming mode:** Connect to `POST /api/voice/stream` (SSE via apiFetch), feed sentence chunks to `StreamingAudioQueue`
- **Fallback mode:** Use `POST /api/voice/turn` (JSON via apiFetch) when SSE fails
- Handle session completion (link to transcript)

**Key State:**

| State | Type | Purpose |
|-------|------|---------|
| `data` | `SessionData \| null` | Full session with messages |
| `loading` | `boolean` | Initial load state |
| `processing` | `boolean` | STT/LLM/TTS in progress |
| `processingStep` | `string` | Human-readable step description |
| `error` | `string` | Error message |
| `useStreaming` | `boolean` | Toggle between SSE and JSON mode |
| `streamItems` | `AudioQueueItem[]` | Sentence chunks for current response |
| `streamFinished` | `boolean` | Queue playback completed |
| `playbackRate` | `number` | AI voice playback speed (persisted via `usePlaybackRate`) |

**First Question Flow:**

```
User clicks "Start Interview"
    │
    ├─ AudioContext is created/resumed inside the click handler (required for auto-play)
    ├─ SentenceAudioQueue is created inside the same user gesture
    │
    ▼
POST /api/voice/start
    │
    ▼
Interviewer message returned with audioUrl
    │
    ▼
Enqueue audioUrl in SentenceAudioQueue → ▶️ auto-play first question
```

**Key point:** the audio queue is created **synchronously inside the click handler**, before the async API call. Browser autoplay policies allow AudioContext playback only after a user gesture, and that permission can expire if we wait for the API round-trip. Creating the queue upfront and enqueuing the audio URL when it returns keeps playback within the allowed gesture window.

**Turn Flow (Streaming — Incremental):**

```
Candidate records answer → AudioRecorder emits blob
    │
    ├─ Submit click is a user gesture: resume shared AudioContext
    ├─ Create fresh SentenceAudioQueue for this turn
    │
    ▼
POST /api/voice/stream (multipart: sessionId + audio, SSE)
    │
    ▼
event: candidate → Add candidate message to state
    │
    ▼
[LLM generating tokens in background]
    │
    ├─ sentence 1 complete ──▶ TTS ──▶ event: sentence (index: 0) ──▶ ▶️ play (~5–6s)
    │
    ├─ sentence 2 complete ──▶ TTS ──▶ event: sentence (index: 1) ──▶ ▶️ play
    │
    ├─ ... more sentences ...

```

**Key point:** `sentence` events arrive **during** LLM generation, not after. The server detects sentence boundaries in the token stream and fires TTS immediately. The `StreamingAudioQueue` appends each chunk as it arrives and plays them gaplessly.

**Turn Flow (Fallback):**

Same as before — `POST /api/voice/turn` returns full JSON response.

**Streaming Toggle:**
A small toggle in the header switches between 🌊 Streaming and ⏹ Standard mode. If SSE fails mid-stream, the UI automatically falls back to `POST /api/voice/turn` with a "Streaming unavailable" banner.

**Mobile:**
- Header stacks vertically on small screens
- Recorder idle target shows "Tap to start recording" with larger text
- Stop / Submit Answer / Discard buttons are `text-base` / `min-h-[44px]` and wrap with `flex-wrap`
- Playback speed selector uses `text-base` / `min-h-[44px]`
- "Start Interview" and "View Transcript" buttons are enlarged for touch

---

### `MessageBubble` (inline in `interview/[id]/page.tsx`)

**Type:** Client component, memoized with `React.memo`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `msg` | `Message` | Single message object |

**Responsibilities:**
- Apply correct bubble styling based on role
- Render role label ("Interviewer" / "You")
- Conditionally render `MarkdownRenderer` (interviewer) or plain text (candidate)
- Show loading dots for empty interviewer messages

**Memoization:** Only re-renders when `msg` object identity changes. Since messages are immutable in our state model, completed messages never re-render.

---

### `TranscriptPage` (`interview/[id]/transcript/page.tsx`)

**Type:** Client component ("use client")

**Responsibilities:**
- Display full interview transcript (loaded via `apiFetch()`)
- Show AI evaluation panel with human override
- Support evaluation generation and re-evaluation with model selection (via `apiFetch()`)
- Support human calibration (score override, recommendation, notes)
- Display version history with select/delete
- View historical evaluation versions (read-only)
- **Play interviewer messages via Speak button with per-message adjustable playback rate**

**Layout:** Two-column grid on desktop:
- **Left (2/3):** Interview transcript with rich Markdown rendering
- **Right (1/3):** AI Evaluation panel with calibration controls

**Mobile:**
- Page padding reduced to `p-4 md:p-6`
- Header/title section stacks vertically
- Playback speed selector, Speak/Stop, and model/re-evaluation controls use `text-base` / `min-h-[44px]` touch targets
- Score star buttons are larger on small screens (`h-10 w-10`)

---

### `DashboardPage` (`dashboard/page.tsx`)

**Type:** Client component ("use client")

**Responsibilities:**
- List all interview sessions (fetched via `apiFetch()` from `/api/sessions`)
- Show statistics cards (total, active, completed, avg AI score)
- Filter by status and search by candidate/position
- Link to individual transcripts

**Features:**
- Status badges with color coding
- AI recommendation badges with calibration indicator (✓)
- Score display: AI overall average + human average if calibrated
- Search and filter controls
- **Mobile:** hides the desktop table below `md` and renders stacked session cards; filters and stats become a responsive card grid

---

### `ComparePage` (`compare/page.tsx`)

**Type:** Client component with `Suspense`

**Responsibilities:**
- Side-by-side comparison of two candidates
- Query params: `?a=session-id-1&b=session-id-2`
- Fetches session and evaluation data via `apiFetch()`
- Shows model badge for each evaluation
- AI star ratings for each dimension
- AI recommendation badges with calibration indicator
- Confidence comparison
- **Mobile:** the comparison table is wrapped in `overflow-x-auto` with `min-w-[36rem]` so users can scroll horizontally without page overflow

---

## Form Components

### `SetupForm` (`setup/SetupForm.tsx`)

**Responsibilities:**
- Receive positions and candidates from parent Client Component page (loaded via `apiFetch()`)
- Dropdown selection for position + candidate
- Create interview session on submit via `apiFetch()`
- Redirect to `/interview/{id}`

**Mobile:**
- Parent page padding is `p-4 md:p-8`
- Form card padding is `p-4 md:p-6` with reduced top margin on small screens
- Selects, mode/voice engine toggles, submit button, and URL copy controls use `text-base` / `min-h-[44px]`

### `PositionForm` (`positions/new/PositionForm.tsx`)

**Responsibilities:**
- Title input
- Level selection (Junior, Mid, Senior, Lead, Principal)
- Job description textarea (optional, used by interviewer and evaluation prompts)
- Requirements tag input (Enter to add, X to remove)
- Create mode: `POST /api/positions` via `apiFetch()`, redirects to `/setup`
- Edit mode: `PATCH /api/positions/{id}` via `apiFetch()`, redirects to `/positions`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `initialData` | `{id, title, level, jobDescription, requirements}` | Optional. When provided, form enters edit mode |

**Mobile:**
- Wrapper padding `p-4 md:p-8`; form card padding `p-4 md:p-6`
- All inputs, selects, and the Add requirement button use `text-base` / `min-h-[44px]`
- Requirement chip remove button is `h-10 w-10` on mobile, `sm:h-6 sm:w-6` on larger screens
- Submit and Cancel buttons are `min-h-[44px]`

---

### `CampaignForm` (`campaigns/new/CampaignForm.tsx`)

**Responsibilities:**
- Name and description inputs
- Optional start/end date pickers
- Tags tag input (Enter to add, X to remove)
- Position multi-select checkbox list
- Create mode: `POST /api/campaigns` via `apiFetch()`, redirects to `/campaigns`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `positions` | `{id, title}[]` | Available positions to assign |

**Mobile:**
- Wrapper padding `p-4 md:p-8`; form card padding `p-4 md:p-6`
- Name/description inputs, date pickers, tag input, Add button, and position checkboxes use `text-base` / `min-h-[44px]`
- Date grid switches from 1 column on mobile to 2 columns on `sm`
- Position checkbox labels are `min-h-[44px]` for touch
- Submit and Cancel buttons are `min-h-[44px]`

---

### `CandidateForm` (`candidates/new/CandidateForm.tsx`)

**Responsibilities:**
- Name and email inputs
- Experience years number input
- Skills tag input (Enter to add, X to remove)
- CV textarea (full text)
- Create mode: `POST /api/candidates` via `apiFetch()`, redirects to `/setup`
- Edit mode: `PATCH /api/candidates/{id}` via `apiFetch()`, redirects to `/candidates`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `initialData` | `{id, name, email, skills, experienceYears, cv}` | Optional. When provided, form enters edit mode |

**Mobile:**
- Wrapper padding `p-4 md:p-8`; form card padding `p-4 md:p-6`
- Name/email/experience inputs, skill input, Add button, and CV textarea use `text-base` / `min-h-[44px]`
- Skill chip remove button is `h-10 w-10` on mobile, `sm:h-6 sm:w-6` on larger screens
- Submit and Cancel buttons are `min-h-[44px]`

---

## Custom Hooks

### `usePlaybackRate`

**Location:** `src/lib/use-playback-rate.ts`

**Type:** Client-side React hook

**Responsibilities:**
- Provide a persistent playback-rate preference for AI voice audio
- Default to `1.0x` (normal speed)
- Persist selected rate to `localStorage`
- Validate against allowed rates: `0.5`, `0.75`, `1.0`, `1.25`, `1.5`, `2.0`

**Return value:** `[rate, setRate]` tuple where:
- `rate` is the current validated playback rate
- `setRate` accepts a number and clamps it to the allowed values

**Usage:**

```tsx
import { usePlaybackRate } from "@/lib/use-playback-rate";

function Player() {
  const [playbackRate, setPlaybackRate] = usePlaybackRate();

  return (
    <select value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}>
      <option value={0.5}>0.5x</option>
      <option value={1.0}>1.0x</option>
      <option value={2.0}>2.0x</option>
    </select>
  );
}
```

**Pages using it:**
- `src/app/interview/[id]/voice/page.tsx` — Voice interview playback (streaming + fallback)

**Note:** The transcript page does **not** use this hook. Each interviewer message there has its own independent playback-rate state, so users can set different speeds for different messages.

---

## Layout Components

### `RootLayout` (`layout.tsx`)

**Type:** Server component (default)

**Responsibilities:**
- Load Geist Sans + Mono fonts
- Navigation bar with links to Dashboard, Setup, Positions, Candidates, Campaigns
- Dark mode support via Tailwind `dark:` classes
- Metadata (title, description)
- Registers the PWA service worker on the client

**Responsive behavior:**
- Desktop (`md:` and up): horizontal link list (`hidden md:flex`)
- Mobile (below `md`): hamburger menu rendered by `MobileNav` (`md:hidden`)
- Same links are available in both contexts

---

## Component Relationships

```
RootLayout
├── Navigation
└── children (page content)
    ├── DashboardPage
    ├── InterviewPage
    │   └── MessageBubble (×N, memoized)
    │       └── MarkdownRenderer (memoized, interviewer only)
    ├── VoiceInterviewPage
    │   ├── AudioPlayer (interviewer messages)
    │   └── AudioRecorder (candidate input)
    ├── TranscriptPage
    │   ├── MarkdownRenderer (interviewer messages)
    │   ├── ScoreInput (human calibration)
    │   ├── ModelBadge
    │   └── VersionHistory
    ├── ComparePage
    ├── SetupPage
    ├── PositionForm
    ├── CandidateForm
    └── CampaignForm
```
