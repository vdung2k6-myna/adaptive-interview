# Edit/Delete Positions and Candidates — Proposal

## Problem

Recruiters currently cannot fix typos in a position title, update a candidate's CV, or remove test entries. Once a position or candidate is created, it is immutable from the UI. The only way to "edit" is to create a new entity and ignore the old one, which clutters the setup dropdowns with stale data.

Specific pain points:
1. **Typos in requirements** — "TypeScript" misspelled as "Typescript" → AI prompt quality degrades
2. **Outdated CVs** — Candidate sends an updated resume after creation; no way to update
3. **Test data accumulation** — "Test Position" and "Test Candidate" entries clutter dropdowns
4. **No single view** — There is no list page to see all positions or all candidates

## Solution

Add edit and delete capabilities for positions and candidates, but **only when they are not referenced by any interview session**. This preserves referential integrity and avoids the complexity of session snapshots or versioning.

Add dedicated list pages (`/positions`, `/candidates`) with edit and delete actions. Reuse the existing creation forms by extending them to support pre-filled edit mode.

## Scope

**In scope:**
- `GET /api/positions/:id` — fetch single position for edit form
- `PATCH /api/positions/:id` — update fields (blocked if any session references it)
- `DELETE /api/positions/:id` — remove row (blocked if referenced)
- `GET /api/candidates/:id` — fetch single candidate for edit form
- `PATCH /api/candidates/:id` — update fields (blocked if referenced)
- `DELETE /api/candidates/:id` — remove row (blocked if referenced)
- New `/positions` page — list all positions with Edit/Delete actions and "in use" count
- New `/candidates` page — list all candidates with Edit/Delete actions and "in use" count
- Extend `PositionForm.tsx` to accept initial data, submit `PATCH` when editing
- Extend `CandidateForm.tsx` to accept initial data, submit `PATCH` when editing
- Update top nav bar to include "Positions" and "Candidates" links
- Update `/setup` to show inline "Edit" links for unused entities

**Out of scope:**
- Editing positions/candidates that have existing sessions (requires session snapshots or versioning)
- Soft deletes or audit trails
- Bulk delete operations
- Re-ordering requirements or skills

## Non-goals
- Session snapshotting (simpler to just create a new position/candidate)
- Position/candidate versioning
- Audit history of edits
- Permission-based edit restrictions (no auth yet)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Accidental deletion of real data | Deletion requires explicit confirmation dialog; only allowed when unused |
| UI clutter from adding list pages | Minimal table design, reuse existing Tailwind patterns from dashboard |
| Referential integrity violation | Enforce at API layer (check `interview_sessions` table before PATCH/DELETE) |
| Embedding drift on position edit | Regenerate requirement embeddings on any requirements change |

## Success Criteria

- Recruiter can edit title, level, and requirements of a position with no sessions
- Recruiter can edit name, email, experience, skills, and CV of a candidate with no sessions
- Edit and delete buttons are disabled/hidden when entity is referenced by any session
- API returns `409 Conflict` if edit/delete attempted on referenced entity
- List pages display entity count and "in use by N sessions" indicator
- Build passes, lint passes, manual testing completes
