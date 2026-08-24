# Proposal: Clean Monolith Backend Code

## Problem

After `complete-backend-extraction`, the monolith (`ollama-chat-react`) still carries backend baggage:

1. **8 Server Component pages do direct database access** via `@/lib/db` and `@/lib/schema`:
   - `candidates/page.tsx` — lists candidates + session counts
   - `candidates/[id]/edit/page.tsx` — fetches candidate by ID
   - `positions/page.tsx` — lists positions + session counts
   - `positions/[id]/edit/page.tsx` — fetches position by ID
   - `campaigns/page.tsx` — lists campaigns + position/session counts
   - `campaigns/[id]/page.tsx` — complex detail query (campaign → positions → sessions → evaluations → candidates)
   - `campaigns/new/page.tsx` — lists positions for dropdown
   - `setup/page.tsx` — lists positions + candidates + session counts for both

2. **13 dead backend files** remain in `src/lib/`, imported by nothing:
   - `embeddings.ts`, `errors.ts`, `evaluation.ts`, `ollama.ts`, `prompts.ts`, `seed.ts`
   - `audio/client.ts`, `audio/index.ts`, `audio/split-sentences.ts`, `audio/storage.ts`, `audio/stt.ts`, `audio/text-processing.ts`, `audio/tts.ts`, `audio/wav-utils.ts`

This means:
- The monolith is **not a pure frontend** — it still connects to PostgreSQL
- `drizzle-orm` and `pg` are still frontend dependencies (pulled in by `schema.ts`, `db.ts`)
- Build complexity is higher than necessary
- Any DB schema change requires touching both repos

## Solution

1. **Enhance backend list endpoints** to include derived counts (candidates and positions already done for campaigns)
2. **Add `GET /api/campaigns/:id`** to backend with full detail aggregation
3. **Convert all 8 pages** from Server Component `db.select()` to Client Component `apiFetch()`
4. **Delete dead files** from `src/lib/`
5. **Replace `schema.ts` types** with lightweight frontend interfaces in `src/lib/types.ts`
6. **Delete `db.ts` and `schema.ts`**

## Scope

### In Scope
- Backend: add `sessionCount` to `GET /api/candidates` and `GET /api/positions`
- Backend: add `GET /api/campaigns/:id` endpoint with pre-computed aggregates
- Frontend: convert 8 pages from async Server Components to Client Components using `apiFetch`
- Frontend: create `src/lib/types.ts` with API response interfaces
- Frontend: delete `src/lib/db.ts`, `src/lib/schema.ts`, and all dead backend files
- Frontend: verify `npm run build` passes with zero errors
- Documentation: update `ARCHITECTURE.md`, `COMPONENTS.md`, `CHANGELOG.md`

### Out of Scope
- Renaming the monolith repo to `adaptive-interview-ui`
- Removing `drizzle-orm`/`pg` from `package.json` (deferred to a dependency audit change)
- Changes to the backend repo beyond the 3 endpoint enhancements listed above

## Risks

| Risk | Mitigation |
|------|-----------|
| SSR → CSR shift causes SEO or performance issues | This is an internal tool; SEO irrelevant. Loading states will replace instant SSR renders. |
| Campaign detail page needs many joins; frontend becomes complex | Add rich `GET /api/campaigns/:id` endpoint to backend so frontend makes 1 call |
| TypeScript types lost when `schema.ts` deleted | Create `src/lib/types.ts` with inferred interfaces; update all components |
| `apiFetch` token (`NEXT_PUBLIC_API_TOKEN`) not set in some environments | Token already required for all other pages; same constraint applies |
| Multiple API calls on setup page (positions + candidates + sessions) | Parallel `Promise.all`; acceptable for an admin setup screen |

## Success Criteria

- [ ] Zero imports of `@/lib/db` or `@/lib/schema` anywhere in `src/app/` or `src/components/`
- [ ] `npm run build` passes with no TypeScript errors
- [ ] All 8 pages render correctly when navigated to in the browser
- [ ] List pages show session counts (from enriched API responses)
- [ ] Campaign detail page shows metrics and top candidates (from new endpoint)
- [ ] `src/lib/db.ts` and `src/lib/schema.ts` deleted
- [ ] All 13 dead backend files deleted
- [ ] `src/lib/` contains only: `api-client.ts`, `audio/sentence-queue.ts`, `config/*`, `types.ts`
