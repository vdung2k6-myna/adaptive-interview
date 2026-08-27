# Fix prompt voice-rule leaks to text mode

## Problem

The system prompt in `adaptive-interview-api/src/lib/prompts.ts` tells the model:

> When generating questions for voice interviews, spell out numbers as Vietnamese words (e.g., "ba năm" instead of "3 năm").

Because this rule sits in the shared system prompt, it applies to **text interviews too**. Text sessions now display questions like *"ba năm"* instead of *"3 năm"*, which is confusing and different from the original text-only behavior.

The rule is also redundant. The TTS layer in `adaptive-interview-api/src/lib/audio/text-processing.ts` already converts Arabic numerals to Vietnamese words **only when the engine is `kokoro`** via `normalizeTextForEngine`. Piper voice sessions should receive raw numerals. Having the LLM itself spell out numbers:

1. Pollutes text sessions.
2. Over-normalizes Piper voice sessions.
3. Duplicates logic that already belongs in the audio pipeline.

## Solution

Remove the Vietnamese number-spelling rule from the system prompt entirely. Rely on the engine-aware TTS normalization that already exists in `normalizeTextForEngine`.

## Scope

### In scope
- `adaptive-interview-api/src/lib/prompts.ts` — remove the voice number rule from `buildSystemPrompt`.
- `docs/OLLAMA.md` if prompt rules are documented there.
- `docs/CHANGELOG.md`.

### Out of scope
- Changing `normalizeTextForEngine` or the TTS pipeline (already correct).
- Adding engine-specific prompt branches.
- Changing voice interview behavior beyond removing the LLM-side rule.

## Non-goals
- No schema changes.
- No frontend changes.
- No new dependencies.

## Risks

| Risk | Mitigation |
|------|-----------|
| Voice + Kokoro loses number normalization | The TTS layer still normalizes before synthesis; verify with a voice turn. |
| Voice + Piper still gets spelled-out numbers from prompt history | Only affects new questions after the change; existing messages stay as stored. |
| Text mode still gets Vietnamese words | Rule is removed, so this cannot happen for new questions. |

## Success Criteria

- [ ] Text interview questions contain Arabic numerals (e.g., "3 năm").
- [ ] Voice interview + Kokoro still reads numbers as Vietnamese words.
- [ ] Voice interview + Piper receives raw numerals.
- [ ] `npm run build` passes in `adaptive-interview-api`.
- [ ] `npm run lint` passes (or only pre-existing warnings).
