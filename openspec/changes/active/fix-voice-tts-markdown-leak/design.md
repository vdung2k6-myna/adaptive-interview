# Design: fix-voice-tts-markdown-leak

## Current state

```
LLM Markdown output
        │
        ├─► UI text mode ──► MarkdownRenderer ──► visual text ✓
        │
        └─► voice TTS pipeline ──► stripMarkdown ──► partial stripping ✗
                                  │
                                  ├─ links still contain [text](url)
                                  ├─ images still contain ![alt](url)
                                  ├─ strikethrough still contains ~~
                                  ├─ horizontal rules (---/***) are spoken
                                  └─ *** lines are partially eaten by italic rule
```

## Target state

```
LLM Markdown output
        │
        ├─► UI text mode ──► MarkdownRenderer ──► visual text ✓
        │
        └─► voice TTS pipeline ──► stripMarkdown ──► clean plain text ✓
                                  │
                                  ├─ links → display text only
                                  ├─ images → alt text only
                                  ├─ strikethrough → plain text
                                  ├─ horizontal rules → removed
                                  └─ inline */_ markers removed
```

## Backend change: `stripMarkdown`

Update the regex chain in `adaptive-interview-api/src/lib/audio/text-processing.ts`:

1. **Fenced code blocks** — already preserved; unchanged.
2. **Horizontal rules** — move earlier in the chain (before italic matching) so `***` lines are removed whole instead of being partially consumed.
3. **Images** — match `![alt](url)` and replace with `alt`. Must run before the link regex so the leading `!` is removed with the image syntax.
4. **Links** — match `[text](url)` and replace with `text`.
5. **Inline code / strikethrough / bold / underline / italic** — unchanged, except ordering now guarantees horizontal rules are gone first.
6. **Whitespace collapse** — unchanged; keeps TTS input as a continuous readable string.

Example:

```markdown
## Question 1

Explain [closure](https://example.com) and the code `() => {}`.

```javascript
const add = (a, b) => a + b;
```
```

becomes for TTS:

```
Question 1 Explain closure and the code () => {}. const add = (a, b) => a + b;
```

## Frontend change

None. Interviewer transcripts already render with `MarkdownRenderer`; candidate transcripts remain plain.

## Security

- No new untrusted input sources.
- Visual rendering continues to use the existing sanitized `MarkdownRenderer`.

## Dependencies

None.

## Testing plan

1. Add unit tests in `adaptive-interview-api/src/lib/audio/text-processing.test.ts` for links, images, strikethrough, horizontal rules, and a mixed-Markdown question.
2. Run `npm test` in the API repo.
3. Run `npm run build` in the API repo.
4. Run `npm run lint` in the API repo.
5. Manual voice interview regression to confirm no formatting characters are spoken.
