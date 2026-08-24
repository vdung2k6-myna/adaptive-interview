# Rich LLM Chat Output — Proposal

## Problem

The LLM's text output is rendered as raw plain text in both the live interview chat and the transcript review page. When the model uses Markdown formatting—bold text, bullet lists, inline code, or fenced code blocks—the candidate and recruiter see literal asterisks, backticks, and hash characters instead of styled, readable output.

## Solution

Parse the LLM's Markdown output with `marked`, syntax-highlight code blocks with tree-shaken `highlight.js`, and safely render the resulting HTML with `dompurify`. Apply this only to `interviewer` role messages; `candidate` messages remain plain text so users see their typed input exactly as entered.

## Scope

**In scope:**
- Create a `MarkdownRenderer` React component (client-side)
- Integrate `marked` with a custom renderer hook for `highlight.js`
- Tree-shake `highlight.js` to import only the most common languages used in technical interviews
- Style code blocks with a custom dark theme (always dark, regardless of app light/dark mode)
- Sanitize HTML with `dompurify` before injection
- Render `interviewer` messages via `MarkdownRenderer` in the live interview page
- Render `interviewer` messages via `MarkdownRenderer` in the transcript review page
- Add Markdown formatting hints to the interviewer prompt (`buildPrompt`)
- Optimize streaming performance: batch React state updates (~50ms intervals)
- Wrap `MarkdownRenderer` and message bubbles in `React.memo` to prevent unnecessary re-renders

**Out of scope:**
- Copy-to-clipboard buttons on code blocks
- Line numbers in code blocks
- Mermaid or other diagram rendering
- Auto-detection of programming language (rely on model-provided language hints)
- Inline editing of rendered Markdown

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Mid-stream incomplete Markdown causes visual jitter (e.g., `**bo` then `**bold**`) | Acceptable for interview-length text (typically <1000 chars). `marked` re-parses fast enough. |
| Prompt injection outputs malicious HTML/JS | `dompurify` strips scripts, event handlers, and dangerous tags before injection. |
| `highlight.js` bundle bloat | Import only ~8 languages via tree-shaken submodules. |
| Theme CSS conflicts | Use a minimal custom theme (no external CSS file) scoped to `.markdown-body pre code`. |

## Success Criteria

- Interview chat renders `**bold**` as bold text, bullet lists as real lists, and fenced code blocks with syntax highlighting.
- Code blocks display with a dark background and `Geist Mono` font in both light and dark app modes.
- No raw Markdown syntax is visible to the candidate during the interview.
- Transcript review page shows identical rich formatting.
- No new security warnings from `dangerouslySetInnerHTML` (sanitization is in place).
- Streaming performance: React state updates are batched to ~20/sec (down from ~100/sec), reducing CPU usage during token streaming.
- Completed messages do not re-render during streaming; only the active streaming message enters React's render phase.
