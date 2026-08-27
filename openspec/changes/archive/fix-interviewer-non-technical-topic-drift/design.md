# Design: fix-interviewer-non-technical-topic-drift

## Current state

```
system prompt
  ├─ "experienced technical interviewer"
  ├─ "Generate one concise interview question at a time"
  ├─ "Keep questions relevant to the position requirements"
  └─ voice number rule (will be moved by another change)

context prompt
  ├─ covered topics
  ├─ remaining topics
  └─ turn count
```

The relevance instruction exists but is weak. The model can interpret "relevant" broadly and drift.

## Target state

Add explicit prioritization rules to the system prompt:

1. **Technical first.** Early turns must focus on technical skills and position requirements.
2. **Use candidate background.** Reference the candidate's skills and CV summary when possible.
3. **Behavioral only as follow-up.** Behavioral or situational questions should follow a technical answer or come after the core requirements are covered.
4. **One question at a time.** Keep the existing rule.

Example wording:

> Prioritize technical questions that probe the position requirements and the candidate's stated skills. Ask behavioral or situational questions only as natural follow-ups to a technical answer, or after the core technical requirements have been covered.

## Optional: coverage weight review

`adaptive-interview-api/src/lib/embeddings.ts` computes `covered` and `remaining` topics. If the prompt change alone does not stop drift, check whether:

- The similarity threshold is too low, marking unrelated topics as "covered".
- The context message over-emphasizes remaining topics at the expense of the technical-first rule.

If needed, tune in a follow-up change; keep this change prompt-focused.

## Data flow

```
buildSystemPrompt()
    │
    ▼
base prompt + technical-first rule
    │
    ▼
buildPrompt(session, messages)
    │
    ▼
Ollama chat request
```

## Security

- No new inputs; only static prompt text changes.

## Dependencies

None.

## Testing plan

1. Start a new text-mode technical interview.
2. Verify the first 3–4 questions are technical and reference the position requirements or candidate skills.
3. Verify later questions may include behavioral follow-ups.
4. Run backend build and lint.
