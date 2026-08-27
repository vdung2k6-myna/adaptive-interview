# Fix voice TTS speaking Markdown formatting characters

## Problem

Voice interview questions are spoken with apparent Markdown formatting characters still in the text. Examples observed by users:

- Links are read as `[display text](https://...)` instead of just the display text.
- Horizontal rules (`---`, `***`) are pronounced as dashes/asterisks.
- Strikethrough (`~~text~~`) is read with literal tildes.
- Image alt text remains wrapped in `![...](...)` syntax.

This happens because `stripMarkdown` in `adaptive-interview-api/src/lib/audio/text-processing.ts` only handled a subset of Markdown constructs (bold, italic, headers, code, lists, blockquotes) and left links, images, strikethrough, and horizontal rules untouched. Additionally, the processing order caused lines like `***` to be partially consumed by the italic regex, leaving stray asterisks.

## Solution

1. **Extend `stripMarkdown`** to remove the additional Markdown constructs:
   - Links: keep display text, drop URL.
   - Images: keep alt text, drop URL.
   - Strikethrough: remove `~~` markers.
   - Horizontal rules: remove lines consisting only of `---`, `***`, or `___`.
2. **Reorder regexes** so horizontal rules are stripped before inline formatting, preventing `***` from being partially matched by the italic rule.
3. Keep visual Markdown rendering in the UI unchanged (handled by `MarkdownRenderer` in `AudioPlayer`).

## Scope

### In scope

- `adaptive-interview-api/src/lib/audio/text-processing.ts` — expand `stripMarkdown` logic and regex ordering.
- `adaptive-interview-api/src/lib/audio/text-processing.test.ts` — add tests for the new constructs.
- `adaptive-interview-api/docs/API.md` — update endpoint descriptions to mention newly stripped Markdown.
- `adaptive-interview/docs/CHANGELOG.md` — add entry.

### Out of scope

- Changing the LLM system prompt or how it generates Markdown.
- Modifying the Audio Gateway or Kokoro/Piper services.
- Changing frontend rendering (already uses `MarkdownRenderer`).

## Non-goals

- No new dependencies.
- No schema or API contract changes.
- No engine-level TTS changes.

## Risks

| Risk | Mitigation |
|------|-----------|
| Aggressive stripping removes legitimate characters | Only target well-known Markdown syntax; avoid broad character classes that could affect code content. |
| Code block content still sounds robotic when spoken | Expected trade-off; the LLM already controls how much code to include. |
| Existing tests break | Add new tests and run full suite; existing behavior for bold/italic/headers/lists/code is preserved. |

## Success Criteria

- [ ] A voice question containing a link is spoken using only the link text.
- [ ] A voice question containing `---` or `***` on its own line does not pronounce dashes/asterisks.
- [ ] Strikethrough text is spoken without tildes.
- [ ] Image alt text is spoken without Markdown syntax.
- [ ] `npm run test` passes in the API repo.
- [ ] `npm run build` passes in the API repo.
- [ ] `npm run lint` passes in the API repo (or only pre-existing warnings).
