# Design: fix-prompt-voice-rule-leaks-to-text-mode

## Current state

```
buildSystemPrompt()
  ├─ "Use Markdown formatting"
  ├─ "Generate one concise interview question at a time"
  └─ "When generating questions for voice interviews, spell out numbers..."
           │
           ▼
  Used by both text and voice routes
```

## Target state

```
buildSystemPrompt()
  ├─ "Use Markdown formatting"
  ├─ "Generate one concise interview question at a time"
  └─ (number rule removed)
           │
           ▼
  Used by both text and voice routes

voice route
  │
  ▼
stripMarkdown() / normalizeTextForEngine(engine)
  ├─ engine=kokoro → normalizeNumbersForKokoro()
  └─ engine=piper  → raw text
```

## Change

1. **Delete the voice number rule** from `buildSystemPrompt` in `adaptive-interview-api/src/lib/prompts.ts`.

   Before:
   ```typescript
   function buildSystemPrompt(): string {
     return `You are an experienced technical interviewer...
   - When generating questions for voice interviews, spell out numbers as Vietnamese words...`;
   }
   ```

   After:
   ```typescript
   function buildSystemPrompt(): string {
     return `You are an experienced technical interviewer...
   (no number-spelling rule)`;
   }
   ```

2. **No prompt signature changes** are required. This is a content-only change.

## Why this is better than making it voice-only

- **Single source of truth:** Number normalization lives in the TTS pipeline, which already knows the engine (`kokoro` vs `piper`).
- **No engine logic in prompts:** Prompts stay mode-agnostic and readable.
- **No leaks:** Removing the rule eliminates the text-mode regression at the root.

## Security

- No new inputs; only static prompt text removed.

## Dependencies

None.

## Testing plan

1. Create a text-mode session, trigger first question, verify numerals are Arabic.
2. Create a voice-mode session with `ttsProvider = "kokoro"`, verify numbers are read as Vietnamese words.
3. Create a voice-mode session with `ttsProvider = "piper"`, verify audio contains raw numerals.
4. Run backend build and lint.
