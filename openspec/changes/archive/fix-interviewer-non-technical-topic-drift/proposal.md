# Fix interviewer non-technical topic drift

## Problem

The interviewer sometimes drifts away from technical, role-relevant questions and asks behavioral or generic questions too early in the conversation. This weakens the adaptive interview signal and makes the scoring less useful for technical hiring.

The current system prompt says the model is an "experienced technical interviewer" but does not explicitly anchor it to the position requirements and candidate skills in the early turns. The embedding-based topic coverage tracker can suggest remaining topics, yet the prompt does not strongly constrain *when* non-technical questions are appropriate.

## Solution

Strengthen the system prompt so the interviewer stays focused on technical, position-relevant topics until technical coverage is solid. Allow behavioral/follow-up questions only as natural follow-ups or after the core technical requirements have been explored.

## Scope

### In scope
- `adaptive-interview-api/src/lib/prompts.ts` — system prompt wording.
- Optional review of `adaptive-interview-api/src/lib/embeddings.ts` coverage weighting if the prompt alone is insufficient.
- `docs/OLLAMA.md` if prompt rules are documented there.

### Out of scope
- Removing behavioral questions entirely.
- Changing the schema or the coverage algorithm fundamentally.
- Adding new evaluation dimensions.

## Non-goals
- No new dependencies.
- No API changes.
- No frontend changes.

## Risks

| Risk | Mitigation |
|------|-----------|
| Over-correction: interviewer becomes robotic | Keep language flexible: "prioritize", not "only". |
| Coverage data still overrides prompt | Review coverage influence; tune if needed. |
| Later behavioral turns feel forced | Allow behavioral follow-ups to technical answers. |

## Success Criteria

- [ ] First 3–4 turns of a technical interview are technical and tied to position requirements.
- [ ] Behavioral questions appear only as natural follow-ups or after solid technical coverage.
- [ ] `npm run build` passes in `adaptive-interview-api`.
- [ ] `npm run lint` passes (or only pre-existing warnings).
