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
- **Drizzle ORM** uses parameterized queries exclusively
- Raw SQL is only used in `embeddings.ts` for vector similarity, with hardcoded table names
- No user input is concatenated into SQL strings

**Code:**

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

**Risk:** API endpoints could make requests to internal services.

**Mitigation:**
- `OLLAMA_BASE_URL` is the only external URL the server calls
- No user-controlled URLs are fetched server-side
- All fetch calls are to known endpoints (`/api/chat`, `/api/embeddings`)

### 5. Authentication (Currently Absent)

**Status:** No authentication or authorization.

**Impact:**
- Anyone with a session URL can participate in an interview
- Anyone can view transcripts and evaluations
- Anyone can create positions, candidates, and sessions

**Recommendation for production:**
- Add OAuth or session-based auth
- Add role-based access (recruiter, admin, candidate)
- Validate that users can only access their own sessions

## Environment Variables

**Sensitive variables that should never be exposed:**

| Variable | Risk | Mitigation |
|----------|------|------------|
| `DATABASE_URL` | Contains DB credentials | Only in `.env.local`, never commit |
| `OLLAMA_BASE_URL` | Could expose internal endpoint | Keep in `.env.local` |

**Non-sensitive variables:**

| Variable | Risk | Notes |
|----------|------|-------|
| `OLLAMA_MODEL` | Low | Just a model name |
| `OLLAMA_EMBED_MODEL` | Low | Just a model name |
| `EMBEDDING_SIMILARITY_THRESHOLD` | Low | Just a number |

## Security Checklist

Before deploying to production:

- [ ] Add authentication (OAuth, sessions, or API keys)
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

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not open a public issue
2. Contact the maintainers privately
3. Allow time for remediation before disclosure
