# Design: Async Evaluation Polling

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Transcript Page                           │
│                                                               │
│  ┌─────────────────┐     ┌──────────────────────────────┐    │
│  │  Session Data   │     │      Evaluation Job State   │    │
│  │  (messages,     │     │                               │    │
│  │   candidate...) │     │  idle ──► posting ──► polling │    │
│  └─────────────────┘     │                         │      │    │
│                          │                         ▼      │    │
│                          │                    completed   │    │
│                          │                        │       │    │
│                          │                        ▼       │    │
│                          │                     failed     │    │
│                          └──────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        POST /evaluate   GET /jobs/:id   GET /evaluations/:id
              │               │               │
              ▼               ▼               ▼
        {jobId}          {status}        {latest, versions}
```

## State Machine

```
          ┌────────────────────────────────────────────────────────┐
          │                                                        │
          ▼                                                        │
    ┌──────────┐     POST /evaluate          ┌──────────┐         │
    │   idle   │ ───────────────────────────▶ │ posting  │         │
    └──────────┘                              └──────────┘         │
          ▲                                     │                │
          │                                     │ 202 {jobId}      │
          │                                     ▼                │
          │                              ┌──────────┐             │
          │                              │ polling  │ ◄───────────┘
          │                              └──────────┘   every 2s
          │                                 │
          │            status: completed    │    status: failed
          │              or re-evaluate     │
          │                 ───────────     │
          └─────────────────────────────  │
                                          ▼
                                    ┌──────────┐
                                    │ completed│
                                    └──────────┘
                                         │
                                         ▼
                                   fetchEvaluation()
                                         │
                                         ▼
                                    ┌──────────┐
                                    │  idle    │
                                    └──────────┘
```

## Data Types

```typescript
interface EvalJobState {
  phase: "idle" | "posting" | "polling" | "completed" | "failed";
  jobId?: string;
  error?: string;
}

// POST /api/sessions/:id/evaluate response
interface StartEvalResponse {
  jobId: string;
  status: string; // "running"
}

// GET /api/evaluations/jobs/:jobId response
interface JobStatusResponse {
  id: string;
  status: "running" | "completed" | "failed";
  result?: LatestEvaluation; // present when completed
  error?: string;            // present when failed
}
```

## Implementation Plan

### 1. State Refactor

Replace `evalLoading: boolean` with discriminated union `EvalJobState`.

```typescript
const [evalJob, setEvalJob] = useState<EvalJobState>({ phase: "idle" });
```

Old booleans to remove:
- `evalLoading` → replaced by `evalJob.phase !== "idle"`
- `evalError`   → absorbed into `evalJob.phase === "failed"`

### 2. startEvaluationJob()

```typescript
async function startEvaluationJob() {
  setEvalJob({ phase: "posting" });

  try {
    const res = await apiFetch(`/api/sessions/${sessionId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel || undefined }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to start evaluation");
    }

    const { jobId }: StartEvalResponse = await res.json();
    setEvalJob({ phase: "polling", jobId });
  } catch (err) {
    setEvalJob({
      phase: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
```

### 3. Polling Effect

```typescript
useEffect(() => {
  if (evalJob.phase !== "polling" || !evalJob.jobId) return;

  const poll = async () => {
    try {
      const res = await apiFetch(`/api/evaluations/jobs/${evalJob.jobId}`);
      if (!res.ok) throw new Error("Poll failed");

      const job: JobStatusResponse = await res.json();

      if (job.status === "completed") {
        setEvalJob({ phase: "completed" });
        await fetchEvaluation();
        setEvalJob({ phase: "idle" }); // reset after showing result
      } else if (job.status === "failed") {
        setEvalJob({
          phase: "failed",
          error: job.error || "Evaluation failed",
        });
      }
      // "running" — do nothing, interval keeps firing
    } catch {
      // Network error during poll — keep trying
      // Or: treat as transient and let interval continue
    }
  };

  poll(); // first check immediately
  const interval = setInterval(poll, 2000);
  return () => clearInterval(interval);
}, [evalJob.phase, evalJob.jobId]);
```

### 4. UI Changes

Replace the existing "Generate Evaluation" section in `transcript/page.tsx`:

**Before (idle / no evaluation):**
```
No evaluation yet.
[Model select]
[Generate Evaluation]  ← enabled
```

**Posting:**
```
Starting evaluation...
[spinner]
[Generate Evaluation]  ← disabled
```

**Polling:**
```
Evaluating... (job: abc-123)
[subtle pulse / spinner]
[Generate Evaluation]  ← disabled
```

**Completed:**
```
→ fetchEvaluation() called, panel shows result
[Generate Evaluation]  ← enabled
```

**Failed:**
```
⚠ Evaluation failed: {error}
[Generate Evaluation]  ← enabled, user can retry
```

### 5. Re-evaluation Safety

When user clicks "Run New Evaluation" while polling:

```typescript
function resetEvalJob() {
  // This automatically cancels the old useEffect (phase !== "polling")
  // and starts a new POST
  setEvalJob({ phase: "idle" });
}
```

Then `startEvaluationJob()` is called. The state reset triggers cleanup, interval stops.

## Security Considerations

- No new attack surface — same endpoints, same auth
- `jobId` is treated as opaque string, never parsed or validated client-side
- Poll responses are not rendered via `dangerouslySetInnerHTML`

## Performance Considerations

- 2-second interval is conservative; backend should handle this easily
- Interval is cleaned up on unmount and state change
- No additional React re-renders beyond existing `fetchEvaluation()` call
