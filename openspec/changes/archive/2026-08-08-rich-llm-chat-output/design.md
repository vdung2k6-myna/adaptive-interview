# Rich LLM Chat Output — Design

## Architecture

The change introduces a presentational component and updates two page components. The data flow is unchanged; rendering is now rich-Markdown + performance-optimized.

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW (UNCHANGED)                     │
│                                                             │
│   Ollama → stream → interview/[id]/page.tsx → state         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 RENDERING (RICH + OPTIMIZED)               │
│                                                             │
│   Streaming layer:                                        │
│     consumeStream() → batch setData() every ~50ms        │
│                                                             │
│   Message list:                                           │
│     messages.map(msg → <MessageBubble key={msg.id} />)     │
│                                                             │
│   Per-message:                                            │
│     msg.role === "interviewer"                              │
│       → <MarkdownRenderer content={msg.content} />          │
│       → React.memo: SKIP if content unchanged              │
│       → marked.parse(content)                               │
│       → highlight.js (custom renderer hook)               │
│       → DOMPurify.sanitize()                              │
│       → dangerouslySetInnerHTML                           │
│                                                             │
│     msg.role === "candidate"                                │
│       → <p className="whitespace-pre-wrap">{msg.content}</p>│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Component: `MarkdownRenderer`

**Location:** `src/components/MarkdownRenderer.tsx`

**Responsibilities:**
- Parse Markdown text to HTML using `marked`
- Highlight fenced code blocks using `highlight.js` via a custom renderer hook
- Sanitize the resulting HTML with `dompurify`
- Return a `<div>` with `dangerouslySetInnerHTML`

**Props:**
- `content: string` — the raw Markdown text to render

**Implementation notes:**
- `marked.setOptions({ gfm: true, breaks: true })` for GitHub-flavored Markdown
- `marked.use({ renderer: { code({ text, lang }) { ... } } })` to inject `hljs` classes
- `DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['class'] })` to preserve `hljs` class names
- Wrapped in `useMemo` to avoid re-parsing on non-content re-renders

## Language Selection

Import only these languages (covering ~95% of typical technical interview topics):

| Language | Import path | Alias registered |
|----------|-------------|------------------|
| JavaScript | `highlight.js/lib/languages/javascript` | `javascript`, `js` |
| TypeScript | `highlight.js/lib/languages/typescript` | `typescript`, `ts` |
| Python | `highlight.js/lib/languages/python` | `python`, `py` |
| Go | `highlight.js/lib/languages/go` | `go` |
| Java | `highlight.js/lib/languages/java` | `java` |
| Rust | `highlight.js/lib/languages/rust` | `rust` |
| SQL | `highlight.js/lib/languages/sql` | `sql` |
| Bash | `highlight.js/lib/languages/bash` | `bash`, `sh`, `shell` |
| JSON | `highlight.js/lib/languages/json` | `json` |

If the model omits the language hint (``` with no tag), fallback to `plaintext` — no highlighting, just monospace.

## Code Block Theme

Code blocks are **always dark** (`#1e1e1e` background) regardless of app light/dark mode. This is intentional and matches industry patterns (GitHub, Stripe, Linear).

Token colors (VS Code Dark+ inspired):
- `keyword` — `#c586c0` (purple: `func`, `return`, `const`)
- `string` — `#ce9178` (orange: `"hello"`)
- `function` / `title` — `#dcdcaa` (yellow: `Println`, `main`)
- `number` — `#b5cea8` (light green: `42`)
- `comment` — `#6a9955` (green, italic)
- `variable` / `params` — `#9cdcfe` (light blue)
- `literal` — `#569cd6` (blue: `true`, `false`, `null`)
- Base text — `#d4d4d4`

Font: `var(--font-geist-mono)` (already loaded in `layout.tsx`).

## Inline Code vs Code Blocks

- Inline code (`` `foo` ``): subtle background (`rgba(0,0,0,0.05)` light, `rgba(255,255,255,0.1)` dark), rounded corners, no syntax highlighting.
- Fenced blocks (```` ```go ````): full dark block, syntax highlighting, horizontal scroll on overflow.

## Component: `MessageBubble` (extracted + memoized)

**Location:** Defined inline in `src/app/interview/[id]/page.tsx`

**Responsibilities:**
- Render a single chat message (interviewer or candidate)
- Apply correct bubble styling based on role
- Memoize to prevent re-renders when parent updates but this message's content is unchanged

**Props:**
- `msg: Message` — a single message object with `id`, `role`, `content`, `createdAt`

**Implementation:**
```tsx
const MessageBubble = React.memo(function MessageBubble({ msg }: { msg: Message }) {
  const bubbleClass = /* role-based Tailwind classes */;
  return (
    <div className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${bubbleClass}`}>
        <p className="text-xs font-medium mb-1 opacity-70">
          {msg.role === "interviewer" ? "Interviewer" : "You"}
        </p>
        {msg.role === "interviewer" ? (
          <MarkdownRenderer content={msg.content} />
        ) : (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        )}
        {msg.role === "interviewer" && msg.content === "" && <LoadingDots />}
      </div>
    </div>
  );
});
```

## Pages Updated

### `src/app/interview/[id]/page.tsx`

Replaced inline `.map()` message rendering with the memoized `<MessageBubble />` component. Interviewer messages render via `<MarkdownRenderer />`; candidate messages remain plain text. Streaming updates are batched to ~50ms intervals.

```tsx
{data?.messages.map((msg) => (
  <MessageBubble key={msg.id} msg={msg} />
))}
```

### `src/app/interview/[id]/transcript/page.tsx`

Same substitution in the transcript message list. The evaluation panel (star ratings, strengths/weaknesses) is untouched.

## Prompt Update

Add a single sentence to the interviewer system prompt in `src/lib/prompts.ts` encouraging the model to use Markdown and specify language hints:

```diff
  Generate the next interview question. One concise question only, no preamble, no explanation.
+ Use Markdown formatting. If you include code examples, specify the language after the opening backticks (e.g., ```python, ```go).
```

This increases the chance that code blocks arrive with correct language tags.

## Styling Strategy

Add custom CSS to `src/app/globals.css` under a new `.markdown-body` block. Do **not** use `@tailwindcss/typography` — the prose plugin is overkill for chat bubbles and brings unwanted margins/typography scales.

Required rules:
- `.markdown-body p` — normal paragraph spacing
- `.markdown-body pre` — dark background, rounded, overflow-x-auto
- `.markdown-body pre code` — Geist Mono, transparent background
- `.markdown-body :not(pre) > code` — inline code styling
- `.markdown-body ul, ol` — list indentation with `list-disc` / `list-decimal`
- `.markdown-body blockquote` — left border, muted opacity
- `.markdown-body h1-h4` — slightly larger, bold (rare but possible)
- `.markdown-body table` — basic bordered table (rare)
- `.markdown-body .hljs-*` token colors

## Security

`dangerouslySetInnerHTML` is safe because:
1. The source is a local Ollama model, not untrusted user input.
2. `DOMPurify.sanitize()` strips `<script>`, `javascript:` URLs, event handlers, and dangerous tags.
3. The allowed attributes list explicitly includes only `class` (for `hljs` classes).
4. No user-provided HTML ever reaches the renderer (candidate messages are plain text).

## Performance Optimizations

Three optimizations were applied to ensure smooth streaming without sacrificing rich rendering.

### 1. Batch React State Updates

Ollama streams tokens every 10-20ms. Without batching, each chunk triggers a `setData()` call, causing ~50-100 React re-renders per second — each re-parsing Markdown with `marked` + `highlight.js`.

Solution: In `consumeStream()`, accumulate chunks in `streamingContentRef` and only flush `setData()` every ~50ms using `performance.now()`.

```
Before:  Chunk → setData → re-render → parse Markdown → repeat (100×/sec)
After:   Chunk → accumulate → ... → setData → re-render → parse Markdown (20×/sec)
```

### 2. React.memo on MarkdownRenderer

`MarkdownRenderer` is wrapped in `React.memo`. When the parent `InterviewPage` re-renders (e.g., on streaming update), completed messages whose `content` hasn't changed are skipped entirely — React never enters the component.

```tsx
export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }) {
  // useMemo + dangerouslySetInnerHTML
});
```

### 3. Memoized MessageBubble

The message rendering logic was extracted from the inline `.map()` in `InterviewPage` into a separate `MessageBubble` component wrapped in `React.memo`. This means:

- **Completed messages**: props unchanged → React skips render phase entirely.
- **Streaming message**: only this one bubble re-renders.
- **Parent InterviewPage**: still re-renders on every `setData()`, but child skipping is where the real savings are.

```
InterviewPage re-renders → .map() over messages
  ├── msg-1 (completed, unchanged) → MessageMemo → SKIP ✓
  ├── msg-2 (completed, unchanged) → MessageMemo → SKIP ✓
  └── msg-3 (streaming, content changed) → MessageMemo → render → MarkdownRenderer → parse
```

### Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| React re-renders/sec | ~50-100 | ~10-20 | **~5-10× fewer** |
| Messages entering render | All | Only streaming | **~N-1 messages skipped** |
| Markdown parses/sec | ~50-100 | ~10-20 | **~5-10× fewer** |
| Perceived smoothness | Choppy | Smooth | **Significant** |

## Dependencies

Add to `dependencies` in `package.json`:
- `highlight.js` — syntax highlighting engine
- `dompurify` — HTML sanitization

`marked` is already installed. No additional `@types/*` packages are required.
