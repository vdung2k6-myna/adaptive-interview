# Edit/Delete Positions and Candidates — Tasks

## API Layer

- [x] Add `GET /api/positions/[id]/route.ts` — return single position
- [x] Add `PATCH /api/positions/[id]/route.ts` — update fields, check session references, regenerate embeddings if requirements changed
- [x] Add `DELETE /api/positions/[id]/route.ts` — delete if no sessions reference it
- [x] Add `GET /api/candidates/[id]/route.ts` — return single candidate
- [x] Add `PATCH /api/candidates/[id]/route.ts` — update fields, check session references
- [x] Add `DELETE /api/candidates/[id]/route.ts` — delete if no sessions reference it

## List Pages

- [x] Create `/app/positions/page.tsx` — list table with Edit/Delete, show "in use" count
- [x] Create `/app/candidates/page.tsx` — list table with Edit/Delete, show "in use" count

## Forms (Edit Mode)

- [x] Update `PositionForm.tsx` — accept `initialData` prop, switch between POST and PATCH
- [x] Update `CandidateForm.tsx` — accept `initialData` prop, switch between POST and PATCH
- [x] Create `/app/positions/[id]/edit/page.tsx` — edit page reusing PositionForm
- [x] Create `/app/candidates/[id]/edit/page.tsx` — edit page reusing CandidateForm

## Navigation & UI Polish

- [x] Add "Positions" and "Candidates" links to nav bar in `layout.tsx`
- [x] Add "Edit" link next to unused entities on `/setup` SetupForm dropdowns
- [x] Add confirmation dialogs for delete actions (`DeleteButton` component)
- [x] Handle API error states (409 Conflict, etc.) in UI

## Documentation

- [x] Update `docs/API.md` with new endpoints
- [x] Update `docs/ARCHITECTURE.md` with new file tree
- [x] Update `docs/COMPONENTS.md` with updated forms and DeleteButton
- [x] Update `docs/CHANGELOG.md` with entry

## Validation

- [x] `npm run build` passes
- [x] `npm run lint` passes (new code clean; pre-existing issues in compare/transcript/test-coverage only)
- [x] Create position → verify appears in list
- [x] Edit unused position → verify changes persist
- [x] Create session with position → verify edit/delete disabled/hidden
- [x] Attempt DELETE on used position via API → verify 409
- [x] Same flow for candidates
