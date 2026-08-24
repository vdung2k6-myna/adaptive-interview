# Security Guide

## Threat Model

This application is designed for internal/local use. The primary threat vectors are:

1. **Prompt injection** — Malicious input influences LLM output
2. **HTML injection** — LLM generates malicious HTML/JS
3. **Database injection** — SQL injection via user input
4. **Server-side request forgery** — API endpoints making unauthorized requests

## Mitigations

### 1. HTML Injection (via LLM Output)

**Risk:** Ollama could return `<script>` tags, event handlers, or JavaScript URLs.

**Mitigation:**
- `DOMPurify.sanitize()` strips all scripts, event handlers, and dangerous tags before `dangerouslySetInnerHTML`
- Only `class` attribute is allowed (for syntax highlighting CSS classes)
- Candidate messages are **never** rendered as HTML — only plain text

**Code:**

```typescript
// MarkdownRenderer.tsx
const html = useMemo(() => {
  const rawHtml = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ["class"], // only allow class attributes
  });
}, [content]);
```

**Verification:**
- Try typing `<script>alert('xss')</script>` as a candidate — it renders as plain text
- Check that interviewer messages with code blocks don't execute scripts

### 2. SQL Injection

**Risk:** User input flows into database queries.

**Mitigation:**
- All database access happens in the **Express backend** (`adaptive-interview-api`)
- The Next.js frontend has no database connection
- **Drizzle ORM** in the backend uses parameterized queries exclusively
- Raw SQL in the backend is only used in `embeddings.ts` for vector similarity, with hardcoded table names
- No user input is concatenated into SQL strings

**Code (backend):**

```typescript
// Safe — Drizzle handles parameterization
db.select().from(messages).where(eq(messages.sessionId, sessionId));

// Safe — raw SQL uses template literals with sql.tag
sql`SELECT * FROM embeddings WHERE source_type = ${sourceType}`;
```

### 3. Prompt Injection

**Risk:** Candidate input influences the interviewer's behavior or extracts system prompt.

**Mitigation:**
- **Limited mitigation** — this is inherent to LLM-based systems
- Candidate messages are sent as `user` role to Ollama (not `system`)
- The model sees the full conversation, including candidate input
- No sensitive data (API keys, internal URLs) is in the prompt

**Recommendations:**
- Use a local Ollama instance (not public API)
- Monitor for prompt injection attempts in logs
- Consider adding input length limits

### 4. SSRF (Server-Side Request Forgery)

**Risk:** The backend could make unauthorized requests to internal services.

**Mitigation:**
- All external calls (Ollama, Audio Gateway, audio.cpp) are centralized in the **Express backend**
- The Next.js frontend does not make server-side external calls at all
- No user-controlled URLs are fetched server-side in the backend
- Backend fetch calls are restricted to known endpoints (`/api/chat`, `/api/embeddings`, `/v1/audio/speech`)

### 5. API Key Authentication

**Status:** Bearer token authentication on all API routes. Validation is performed by the **Express backend** (`adaptive-interview-api`).

**How it works:**
- `API_AUTH_TOKEN` environment variable sets the shared secret (configured in the backend)
- The backend validates `Authorization: Bearer <token>` header on every API request
- If `API_AUTH_TOKEN` is not set, auth is disabled (backward-compatible for local dev)
- The frontend uses `apiFetch()` wrapper (reads `NEXT_PUBLIC_API_TOKEN`) to inject the header automatically in browser requests
- Next.js development rewrites proxy `/api/*` to the backend, so the backend sees and validates all requests

**Impact:**
- Prevents unauthorized API access when token is configured
- Session URLs still allow anonymous interview participation (by design)

**Environment variables:**

| Variable | Location | Purpose | Required |
|----------|----------|---------|----------|
| `API_AUTH_TOKEN` | Backend `.env` | Server-side secret; enables auth when set | No (optional) |
| `NEXT_PUBLIC_API_TOKEN` | Frontend `.env.local` | Client-side copy; must match `API_AUTH_TOKEN` | Only if auth enabled |

**Recommendation for production:**
- Set a strong `API_AUTH_TOKEN` (≥32 characters) in the backend
- Set `NEXT_PUBLIC_API_TOKEN` to the same value in the frontend
- Add OAuth or session-based auth for recruiter UI
- Add role-based access control
- Validate that users can only access their own sessions

### 6. Voice Data Privacy

**Risk:** Voice interviews generate audio recordings that may contain PII (names, personal details spoken aloud).

**Mitigation:**
- Audio files are stored on the **backend local filesystem** (`/tmp/audio/{sessionId}/`), not in the database
- The frontend never receives or stores raw audio blobs — only plays served files
- Audio filenames use **UUIDs**, not candidate names (e.g. `candidate-{uuid}.webm`, `interviewer-{uuid}.wav`)
- Audio files are **not included** in session exports or MCP tool responses
- Session deletion does not automatically delete audio files (manual cleanup required)
- The Audio Gateway is **read-only** for TTS — it never receives or stores STT audio

**Recommendation:**
- Implement a retention policy in the backend (e.g. delete audio files after 30 days)
- Encrypt audio files at rest if required by compliance
- Audit that audio URLs are not logged with candidate identifiers

## Environment Variables

**Sensitive variables that should never be exposed:**

| Variable | Location | Risk | Mitigation |
|----------|----------|------|------------|
| `DATABASE_URL` | Backend `.env` | Contains DB credentials | Never commit |
| `OLLAMA_BASE_URL` | Backend `.env` | Could expose internal endpoint | Keep in backend `.env` |
| `MCP_AUTH_TOKEN` | Backend `.env` | Could expose analytics access | Rotate regularly, never commit |
| `API_AUTH_TOKEN` | Backend `.env` | Grants full API access | Rotate regularly, never commit |
| `NEXT_PUBLIC_API_TOKEN` | Frontend `.env.local` | Client-side API token | Must match backend `API_AUTH_TOKEN`; never commit |

**Non-sensitive variables:**

| Variable | Risk | Notes |
|----------|------|-------|
| `OLLAMA_MODEL` | Low | Just a model name |
| `OLLAMA_EMBED_MODEL` | Low | Just a model name |
| `EMBEDDING_SIMILARITY_THRESHOLD` | Low | Just a number |

## Security Checklist

Before deploying to production:

- [x] Add API key authentication (Bearer token on all routes)
- [ ] Add OAuth or session-based auth for recruiter UI
- [ ] Add authorization (role-based access control)
- [ ] Enable HTTPS
- [ ] Set up CSP (Content Security Policy) headers
- [ ] Rate limit API endpoints
- [ ] Add input validation/sanitization middleware
- [ ] Review CORS configuration
- [ ] Enable PostgreSQL SSL connections
- [ ] Rotate database credentials
- [ ] Set up audit logging
- [ ] Run `npm audit` and fix vulnerabilities

## Voice Interview Security

Voice interviews introduce additional security and privacy considerations.

### Audio Data Storage

- **Location:** Audio files are stored on the local filesystem (`/tmp/audio/{sessionId}/` by default)
- **Filenames:** Use random UUIDs — no candidate names or PII in filenames
- **Access:** Served via `/audio/{sessionId}/{filename}` route with path traversal protection
- **Retention:** No automatic cleanup — implement TTL or cron job for production

### Privacy Considerations

- Voice data is biometric — consider GDPR / CCPA implications
- Same anonymization rules as text: audio files are tied to session UUID, not candidate identity
- audio.cpp server should run on local network only (not exposed to internet)
- No encryption at rest for audio files (future enhancement)

### Environment Variables

| Variable | Risk | Mitigation |
|----------|------|------------|
| `AUDIOCPP_BASE_URL` | Could expose internal audio endpoint | Keep in `.env.local`, local network only |

---

## MCP Server Security

> **Location:** The MCP analytics server (`/api/mcp`) lives in the `adaptive-interview-api` backend repository. See the backend documentation for its security model.

The MCP server follows a defense-in-depth security model:

- **Authentication:** `MCP_AUTH_TOKEN` via `Authorization: Bearer <token>`, validated in the backend with timing-safe comparison
- **Anonymization:** All tool responses strip PII (names, emails, CVs, raw responses) and replace `candidateId` with stable anonymized UUIDs
- **Read-only:** No tool performs writes, updates, or deletions
- **Recommendation:** Do not expose `/api/mcp` to the public internet without rate limiting

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not open a public issue
2. Contact the maintainers privately
3. Allow time for remediation before disclosure
