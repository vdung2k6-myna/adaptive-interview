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
- Calls `DELETE /api/{type}s/{id}`
- Refreshes the page via `router.refresh()` on success
- Shows alert on error

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
POST /api/messages → Returns ReadableStream
    │
    ▼
consumeStream():
    - Accumulate chunks in streamingContentRef
    - Batch setData() every ~50ms (not every chunk)
    - Update message content incrementally
    - On completion: fetchSession() to get persisted data
```

**Performance Optimizations:**
- `MessageBubble` extracted and wrapped in `React.memo`
- Only the streaming message re-renders; completed messages are skipped
- State updates batched to ~20/sec instead of ~100/sec

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
- Display full interview transcript
- Show AI evaluation panel with human override
- Support evaluation generation and re-evaluation with model selection
- Support human calibration (score override, recommendation, notes)
- Display version history with select/delete
- View historical evaluation versions (read-only)

**Layout:** Two-column grid on desktop:
- **Left (2/3):** Interview transcript with rich Markdown rendering
- **Right (1/3):** AI Evaluation panel with calibration controls

---

### `DashboardPage` (`dashboard/page.tsx`)

**Type:** Client component ("use client")

**Responsibilities:**
- List all interview sessions
- Show statistics cards (total, active, completed, avg AI score)
- Filter by status and search by candidate/position
- Link to individual transcripts

**Features:**
- Status badges with color coding
- AI recommendation badges with calibration indicator (✓)
- Score display: AI overall average + human average if calibrated
- Search and filter controls

---

### `ComparePage` (`compare/page.tsx`)

**Type:** Client component with `Suspense`

**Responsibilities:**
- Side-by-side comparison of two candidates
- Query params: `?a=session-id-1&b=session-id-2`
- Shows model badge for each evaluation
- AI star ratings for each dimension
- AI recommendation badges with calibration indicator
- Confidence comparison

---

## Form Components

### `SetupForm` (`setup/SetupForm.tsx`)

**Responsibilities:**
- Load positions and candidates from API
- Dropdown selection for position + candidate
- Create interview session on submit
- Redirect to `/interview/{id}`

### `PositionForm` (`positions/new/PositionForm.tsx`)

**Responsibilities:**
- Title input
- Level selection (Junior, Mid, Senior, Lead, Principal)
- Job description textarea (optional, used by interviewer and evaluation prompts)
- Requirements tag input (Enter to add, X to remove)
- Create mode: `POST /api/positions`, redirects to `/setup`
- Edit mode: `PATCH /api/positions/{id}`, redirects to `/positions`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `initialData` | `{id, title, level, jobDescription, requirements}` | Optional. When provided, form enters edit mode |

---

### `CampaignForm` (`campaigns/new/CampaignForm.tsx`)

**Responsibilities:**
- Name and description inputs
- Optional start/end date pickers
- Tags tag input (Enter to add, X to remove)
- Position multi-select checkbox list
- Create mode: `POST /api/campaigns`, redirects to `/campaigns`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `positions` | `{id, title}[]` | Available positions to assign |

---

### `CandidateForm` (`candidates/new/CandidateForm.tsx`)

**Responsibilities:**
- Name and email inputs
- Experience years number input
- Skills tag input (Enter to add, X to remove)
- CV textarea (full text)
- Create mode: `POST /api/candidates`, redirects to `/setup`
- Edit mode: `PATCH /api/candidates/{id}`, redirects to `/candidates`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `initialData` | `{id, name, email, skills, experienceYears, cv}` | Optional. When provided, form enters edit mode |

---

## Layout Components

### `RootLayout` (`layout.tsx`)

**Type:** Server component (default)

**Responsibilities:**
- Load Geist Sans + Mono fonts
- Navigation bar with links to Dashboard, Setup, Positions, Candidates
- Dark mode support via Tailwind `dark:` classes
- Metadata (title, description)

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
