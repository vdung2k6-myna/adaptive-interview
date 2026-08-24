# Evaluation Calibration — Proposal

## Problem

The AI evaluation system produces structured scores (technicalDepth, communicationClarity, problemSolving, relevanceToRole) and a recommendation, but these scores lack credibility because:

1. **Non-determinism** — The same transcript evaluated twice can produce different scores (temperature 0.3 reduces but doesn't eliminate variance)
2. **Model inconsistency** — `llama3.1` might score a candidate `4/5` while `qwen2.5-coder` scores them `3/5` for the same dimension
3. **No human override** — Recruiters see AI scores but cannot record their own independent assessment alongside them
4. **Confidence is a single number** — The `confidence` field (0-100) is displayed as-is, providing no nuance about which dimensions the model is uncertain on
5. **No history** — Re-evaluating a session overwrites the previous evaluation; there's no way to compare how different models scored the same candidate

**Result:** Recruiters look at the dashboard "Avg Score" and comparison tables, but they don't trust the numbers. The evaluation feature is decorative, not actionable.

## Solution

Make evaluation scores trustworthy and actionable by:

1. **Recording human judgments** — Let recruiters override any AI score with their own independent assessment
2. **Tracking model history** — Store multiple evaluations per session (one per model), never overwrite
3. **Displaying model comparison** — Show scores side-by-side when multiple models have evaluated the same transcript
4. **Exposing score uncertainty** — Show confidence as a per-dimension indicator, not just a single number
5. **Calibrating over time** — Track which models align with human judgments to help recruiters choose the right model

## Scope

**In scope:**
- Add human override fields to evaluations (recruiter-assigned scores for each dimension)
- Add evaluation history table (multiple evaluations per session, one per model)
- Update transcript evaluation panel with editable score inputs for recruiters
- Show AI score vs Human score comparison in the evaluation panel
- Display per-dimension confidence indicators (visual bars, not just numbers)
- Add "Re-evaluate with different model" button on transcript page
- Show model badge on each evaluation (which model generated it)
- Update dashboard to show human-calibrated scores when available, falling back to AI scores
- Update compare page to show human vs AI scores side-by-side

**Out of scope:**
- Machine learning on human judgments to auto-calibrate models (interesting future work, but requires significant data)
- External ATS integration (export to Greenhouse, Lever, etc.)
- Real-time evaluation during the interview (only post-interview)
- Score normalization algorithm across models
- Statistical significance testing for score variance

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Recruiters don't bother entering human scores | Make inputs prominent but non-blocking; show "Unreviewed" badge until human scores are entered |
| Database migration complex with evaluation history | Create a new `evaluation_versions` table; keep existing `evaluations` table minimally changed |
| UI becomes cluttered with too many scores | Default to showing only AI + Human overall; expand for detail view |
| Model comparison confuses rather than helps | Default to hiding model comparison; show only when recruiter explicitly re-evaluates with another model |

## Success Criteria

- Recruiters can enter independent human scores for all 4 dimensions
- Human scores are visually distinguished from AI scores (different colors, labels)
- Dashboard "Avg Score" uses human score when available, AI score as fallback
- Multiple evaluations for the same session are stored and viewable
- Model badge is visible on every evaluation
- Build passes, lint passes, all existing tests continue to work
