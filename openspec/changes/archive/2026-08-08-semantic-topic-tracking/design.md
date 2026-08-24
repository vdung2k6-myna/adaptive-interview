# Semantic Topic Tracking — Design

## Context

The adaptive interview engine currently tracks "topics covered" via a hardcoded keyword list (`react`, `docker`, `typescript`, etc.) extracted from conversation messages. This list is passed to Ollama in the system prompt to steer question diversity. The approach is brittle: it cannot understand synonyms, conflates mentions with actual coverage, and requires manual keyword maintenance.

We have already enabled `pgvector 0.8.2` in PostgreSQL. The embedding model chosen is `mxbai-embed-large` (1024 dimensions, Ollama-hosted at `https://myna.ddns.net:8080`).

## Goals / Non-Goals

**Goals:**
- Replace keyword extraction with semantic similarity matching using embeddings
- Track which position requirements have been meaningfully addressed in each session
- Generate prompts that tell the LLM exactly which requirements remain uncovered

**Non-Goals:**
- Real-time streaming of embeddings
- Embedding-based candidate–position matching (only coverage tracking)
- Answer evaluation or scoring
- Support for multiple embedding models simultaneously
- Fallback to keyword matching on embedding failure

## Decisions

### 1. Hybrid schema: Drizzle table + raw SQL for vector ops
**Decision:** Store embeddings in a Drizzle-managed table with `embedding` as `text` (JSON string), and use raw SQL with `::vector` casts for similarity queries.

**Rationale:**
- `text` is dimension-agnostic; switching from `mxbai-embed-large` (1024) to another model does not require a schema migration.
- Drizzle ORM's native `vector` support is still experimental and dimension-locked.
- Raw SQL gives us full control over pgvector operators (`<->`, `<=>`, `<#>`).

**Critical implementation note:**
- When casting JSON strings to `vector` in raw SQL queries, the dimension must be a literal constant. Drizzle's `sql` template parameterizes values, so `vector(${EMBED_DIMENSION})` generates `vector($1)`, which PostgreSQL rejects with `type modifiers must be simple constants or identifiers`. The fix is to use `sql.raw(String(EMBED_DIMENSION))` for the dimension only:
  ```typescript
  sql`r.embedding::vector(${sql.raw(String(EMBED_DIMENSION))}) <=> m.embedding::vector(${sql.raw(String(EMBED_DIMENSION))})`
  ```

**Alternative considered:**
- Use `float8[]` column: rejected because pgvector's optimized operators do not work on plain arrays; we'd lose `ORDER BY embedding <-> query` performance.

### 2. Requirement embeddings generated at position creation
**Decision:** When a position is created via `POST /api/positions`, split `requirements` into individual strings, generate one embedding per requirement, and store them with `source_type = 'requirement'`.

**Rationale:**
- Requirements are static; embedding once avoids redundant work.
- Per-requirement embeddings allow fine-grained coverage queries ("has requirement #3 been covered?").

**Alternative considered:**
- Embed the full requirements list as a single blob: rejected because it destroys granularity. A candidate might cover 3 of 5 requirements in one long answer, and a single blob would not reveal that.

### 3. Message embeddings generated synchronously in `POST /api/messages`
**Decision:** After storing a candidate message, call Ollama for the embedding before building the next prompt. The embedding latency (~200–500ms) is on the critical path.

**Rationale:**
- Coverage must include the just-submitted message, otherwise the next question might repeat a topic the candidate just discussed.
- Parallelizing with Ollama question generation is technically possible but complicates error handling and ordering.

**Trade-off:**
- Slower per-turn response by ~200–500ms. On a local Ollama setup where question generation already takes 2–5s, this is acceptable.

### 4. Cosine similarity threshold: 0.75 (configurable via env)
**Decision:** A requirement is considered "covered" if the maximum cosine similarity between any of its embeddings and any session message embedding is ≥ 0.75.

**Rationale:**
- 0.75 is a pragmatic starting point: high enough to avoid false positives, low enough to catch paraphrased coverage.
- Making it an environment variable (`EMBEDDING_SIMILARITY_THRESHOLD`) lets us tune without redeploying.

**Alternative considered:**
- Dynamic threshold based on requirement count: rejected as over-engineering for the first slice.

### 5. Embeddings stored per message, not per session aggregate
**Decision:** Each message gets its own embedding row. Coverage queries aggregate across all message embeddings for a session.

**Rationale:**
- Preserves the full semantic history of the conversation.
- Enables future features like "what topics were covered in the last 3 turns?" (time-decay coverage).

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Ollama embedding endpoint is unreachable or model not pulled | Return a clear 503 error; app does not fall back to keywords |
| Embedding latency spikes past acceptable UX threshold | Make threshold and model configurable; add request timeout |
| pgvector query performance degrades with many messages | Add `session_id` + `source_type` composite index; consider HNSW if table grows past 10k rows |
| pgvector `vector(N)` casts fail when dimension is parameterized in SQL templates | Use `sql.raw()` for the dimension literal; never parameterize type modifiers |
| `mxbai-embed-large` produces worse results than expected for short phrases like "React" | Test with actual requirement strings; if needed, prepend a prompt template before embedding (e.g., "Technical requirement: React") |
| Changing embedding model requires re-embedding all historical data | Accept as known limitation; document that model changes require backfill migration |

## Migration Plan

1. Run Drizzle migration to create `embeddings` table.
2. Seed existing positions: for each row, generate requirement embeddings via a one-time script.
3. Ensure Ollama host has `mxbai-embed-large` pulled.
4. Set `OLLAMA_EMBED_MODEL=mxbai-embed-large` and `EMBEDDING_SIMILARITY_THRESHOLD=0.75` in environment.
5. Deploy API changes; existing sessions continue to work (they just won't have embeddings for historical messages, which is fine — coverage only applies to new sessions).

## Open Questions

- Should we add `embedding` columns to the `messages` and `positions` tables directly instead of a separate table? This would be simpler but couples schema to embedding decisions.
- Do we need to handle the case where a requirement is a very short phrase (e.g., "AWS") and the embedding is noisy?
- Should we add `embedding_dimension` to the `embeddings` table to support future model switches without backfill?
