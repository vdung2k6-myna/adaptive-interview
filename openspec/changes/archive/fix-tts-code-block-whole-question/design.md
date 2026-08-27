# Design: fix-tts-code-block-whole-question

## Current state

```
LLM Markdown output
        │
        ├─► UI text mode ──► MarkdownRenderer ──► visual text ✓
        │
        └─► TTS pipeline ──► stripMarkdown ──► "code example" ✗
                                  │
                                  └─► voice UI ──► plain text ✗
```

## Target state

```
LLM Markdown output
        │
        ├─► UI text mode ──► MarkdownRenderer ──► visual text ✓
        │
        ├─► voice UI ──► AudioPlayer ──► MarkdownRenderer ──► visual text ✓
        │
        └─► TTS pipeline ──► stripMarkdown ──► readable plain text ✓
```

## Backend change: `stripMarkdown`

Update the regex chain in `adaptive-interview-api/src/lib/audio/text-processing.ts`:

1. **Fenced code blocks**
   - Replace `` ```lang\n...\n``` `` with the block content.
   - Strip the opening fence and optional language tag.
   - Strip the closing fence.
   - Preserve the code text; do not replace it with `"code example"`.

2. **Inline code**
   - Already handled by `` `.replace(/`([^`]+)`/g, "$1") `` — keep this.

3. **Whitespace collapse**
   - Continue collapsing newlines to spaces and multiple spaces to one, so TTS receives a single continuous string.

Example:

```markdown
What does this print?
```python
print("hello")
```
```

becomes:

```
What does this print? print("hello")
```

## Frontend change: `AudioPlayer`

`adaptive-interview/src/components/AudioPlayer.tsx` currently renders:

```tsx
<div className="...">{transcript}</div>
```

Change it to:

```tsx
{role === "interviewer" ? (
  <MarkdownRenderer content={transcript} />
) : (
  <p className="whitespace-pre-wrap">{transcript}</p>
)}
```

Candidate messages are plain transcription text, so they stay as pre-wrapped text.

## Security

- `MarkdownRenderer` already sanitizes with `DOMPurify` before `dangerouslySetInnerHTML`.
- No new untrusted input sources.

## Dependencies

None. `MarkdownRenderer` already exists in the frontend.

## Testing plan

1. Backend: add/update the existing `text-processing.test.ts` to cover fenced code block stripping.
2. Frontend: run build and lint.
3. End-to-end voice interview with a code question; verify audio and visual rendering.
4. Regression: text-mode interview still renders Markdown correctly.
