# Rich LLM Chat Output — Tasks

## Phase 1: Core Rich Rendering

- [x] **Task 1: Install dependencies**
  Install `highlight.js` and `dompurify` into the project.

- [x] **Task 2: Create `MarkdownRenderer` component**
  Create `src/components/MarkdownRenderer.tsx` with tree-shaken `highlight.js`, `marked` renderer hook, `DOMPurify.sanitize()`, and `useMemo`-wrapped HTML generation.

- [x] **Task 3: Add custom CSS for Markdown + syntax highlighting**
  Update `src/app/globals.css` with `.markdown-body` base styles, dark code block theme, inline code styling, and `.hljs-*` token colors.

- [x] **Task 4: Update interview page (`interview/[id]/page.tsx`)**
  Replace plain text `<p>` rendering for `interviewer` role messages with `<MarkdownRenderer />`. Leave candidate messages as plain text.

- [x] **Task 5: Update transcript page (`interview/[id]/transcript/page.tsx`)**
  Replace plain text `<p>` rendering for `interviewer` role messages in the transcript list with `<MarkdownRenderer />`.

- [x] **Task 6: Update interviewer prompt**
  Append Markdown formatting and code block language hint instructions to the system prompt in `src/lib/prompts.ts`.

- [x] **Task 7: End-to-end validation**
  Run a full interview session and verify rich rendering in both light and dark modes, correct syntax highlighting, and that candidate messages remain plain text.

## Phase 2: Performance Optimizations

- [x] **Task 8: Batch React state updates during streaming**
  In `interview/[id]/page.tsx`, modify `consumeStream()` to batch `setData()` calls every ~50ms instead of on every single chunk. This reduces React re-renders from ~100/sec to ~20/sec during streaming.

- [x] **Task 9: Wrap MarkdownRenderer in React.memo**
  Add `React.memo` to `MarkdownRenderer` so parent re-renders don't re-run the component when `content` prop is unchanged.

- [x] **Task 10: Extract MessageBubble with React.memo**
  Extract the message rendering logic from the inline `.map()` in `interview/[id]/page.tsx` into a separate `MessageBubble` component wrapped in `React.memo`. This prevents completed messages from entering React's render phase during streaming.

- [x] **Task 11: Validate optimizations**
  Build passes, lint passes, and streaming feels smoother in the interview page.
