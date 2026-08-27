# Fix TTS "code example" placeholder for whole code-block questions

## Problem

When the interviewer asks a question that includes a fenced code block, the TTS pipeline in `adaptive-interview-api/src/lib/audio/text-processing.ts` replaces the **entire block** with the literal phrase `"code example"`. The candidate hears something like:

> "Here is code example. What does it print?"

instead of the actual code. This happens because `stripMarkdown` uses:

```typescript
.replace(/```[\s\S]*?```/g, " code example ")
```

Additionally, in voice mode the transcript shown in the UI is raw Markdown (`\`\`\`python ...`), which is hard to read. The user expects the interviewer output to be **visual rendered text** while the audio receives cleaned plain text.

## Solution

1. **Preserve code content for TTS.** Change `stripMarkdown` so fenced code blocks keep their inner text (minus the fence and language tag), and inline code keeps its content. Collapse newlines/whitespace as before so the TTS engine receives a continuous readable string.
2. **Render Markdown visually in voice mode.** Use the existing `MarkdownRenderer` component for interviewer transcripts inside `AudioPlayer`, so the candidate sees formatted code blocks instead of raw Markdown.

## Scope

### In scope
- `adaptive-interview-api/src/lib/audio/text-processing.ts` — `stripMarkdown` logic.
- `adaptive-interview/src/components/AudioPlayer.tsx` — render interviewer transcript with `MarkdownRenderer`.
- `adaptive-interview/src/app/interview/[id]/voice/page.tsx` — pass raw content to `AudioPlayer` (already does; no change likely needed).
- Docs: `docs/COMPONENTS.md`, `docs/OLLAMA.md` or `docs/ARCHITECTURE.md` if relevant.

### Out of scope
- Changing how the LLM generates code blocks.
- Changing text-mode rendering (already uses `MarkdownRenderer`).
- Adding syntax highlighting to audio.

## Non-goals
- No new dependencies.
- No backend schema changes.
- No changes to the TTS engine itself.

## Risks

| Risk | Mitigation |
|------|-----------|
| Code content is hard for TTS to pronounce | Still better than "code example"; acceptable trade-off. |
| MarkdownRenderer in AudioPlayer changes card layout | Test mobile viewport; wrap in `overflow-x:auto`. |
| Stripping fences may leave language tag in TTS text | Strip the first line after opening fence. |

## Success Criteria

- [ ] A voice question containing a code block is read aloud with code content, not "code example".
- [ ] Voice-mode interviewer transcript renders code blocks visually with syntax highlighting.
- [ ] Text-mode interviewer messages continue to render correctly.
- [ ] `npm run build` passes in both repos.
- [ ] `npm run lint` passes (or only pre-existing warnings).
