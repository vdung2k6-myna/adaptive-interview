## 1. Database Schema & Migration

- [x] 1.1 Add `embeddings` table to `src/lib/schema.ts` with `id`, `sourceType`, `sourceId`, `content`, `embedding` (text), `createdAt`
- [x] 1.2 Add composite index on `(source_type, source_id)` and `(session_id)` for coverage queries
- [x] 1.3 Generate Drizzle migration with `drizzle-kit generate`
- [x] 1.4 Apply migration to local Postgres

## 2. Ollama Embedding Client

- [x] 2.1 Create `src/lib/ollama.ts` `embedText(text: string)` function calling Ollama `/api/embeddings` with `mxbai-embed-large`
- [x] 2.2 Add timeout (10s) and error handling for embedding requests
- [x] 2.3 Add `OLLAMA_EMBED_MODEL` and `EMBEDDING_SIMILARITY_THRESHOLD` env var defaults
- [x] 2.4 Verify embedding output is a 1024-dimension float array *(verified during E2E test)*

## 3. Embedding Service

- [x] 3.1 Create `src/lib/embeddings.ts` with `storeRequirementEmbedding(positionId, requirement, vector)`
- [x] 3.2 Create `storeMessageEmbedding(sessionId, messageId, content, vector)` in `src/lib/embeddings.ts`
- [x] 3.3 Create `getRequirementCoverage(sessionId, positionId, threshold)` using raw SQL with `vector` casts and cosine similarity
  - **Bug fix discovered during build:** PostgreSQL requires literal constants in `vector(N)` type modifiers. Drizzle's `sql` template parameterizes values, so `vector(${EMBED_DIMENSION})` generates `vector($1)` which PostgreSQL rejects. Fixed by using `sql.raw(String(EMBED_DIMENSION))` for the dimension literal.
- [x] 3.4 Unit-test coverage query with mock data: verify synonym matching works

## 4. API Route Changes

- [x] 4.1 Update `POST /api/positions` to split requirements and call `storeRequirementEmbedding` for each
- [x] 4.2 Update `POST /api/messages` to generate and store message embedding after inserting the candidate message
- [x] 4.3 Ensure `POST /api/messages` awaits embedding before building the prompt (critical path)
- [x] 4.4 Add 503 error response when Ollama embedding fails or model is unavailable

## 5. Prompt Builder Refactor

- [x] 5.1 Make `buildPrompt()` async and accept `sessionId` + `positionId`
- [x] 5.2 Replace `extractTopics()` and keyword matching with call to `getRequirementCoverage()`
- [x] 5.3 Format `Topics already covered` and `Remaining topics to explore` from coverage query results
- [x] 5.4 Remove hardcoded `keywords` array from `src/lib/prompts.ts`

## 6. End-to-End Verification

- [x] 6.1 Create a position with requirements `["React", "System design", "Docker"]` *(runtime verification)*
- [x] 6.2 Start an interview session and verify requirement embeddings exist in DB *(runtime verification)*
- [x] 6.3 Submit candidate answer mentioning containers and verify Docker requirement is marked covered *(runtime verification)*
- [x] 6.4 Verify remaining requirements list is accurate after each turn *(runtime verification)*
- [x] 6.5 Test timeout scenario by simulating slow Ollama embedding *(runtime verification)*
