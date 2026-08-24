# Semantic Topic Tracking

## Why

The current adaptive interview engine uses naive keyword matching to track which topics have been covered. This is brittle: it misses synonyms, conflates passing mentions with actual coverage, and produces stale topic lists. We need semantic understanding of the conversation so the interviewer asks relevant, non-repetitive questions.

## What Changes

- Add an `embeddings` table to store requirement and message embeddings
- Integrate Ollama `mxbai-embed-large` (1024-dim) for embedding generation
- Replace keyword extraction in `buildPrompt()` with pgvector cosine-similarity queries
- Embed requirements at position-creation time; embed candidate messages at message-creation time
- Refactor `prompts.ts` to query coverage from the database instead of scanning messages

## Capabilities

### New Capabilities
- `semantic-topic-coverage`: Track which position requirements have been semantically addressed in an interview session using pgvector and embeddings

### Modified Capabilities
- *(none — no existing specs to modify)*

## Impact

- Database: new `embeddings` table; pgvector extension already enabled
- API: `POST /api/positions` gains embedding generation step
- API: `POST /api/messages` gains async embedding generation (critical path)
- Prompt builder: `buildPrompt()` becomes async and queries the database
- New dependency: Ollama host must have `mxbai-embed-large` pulled

## Non-goals

- Embedding-based answer evaluation or scoring
- Vector search for candidate–position matching (out of scope)
- Streaming question generation
- Admin UI for visualizing coverage
- Fallback to keyword matching if embeddings fail
- Supporting multiple embedding models simultaneously
