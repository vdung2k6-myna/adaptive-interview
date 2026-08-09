# API Documentation

## Base URL

All API routes are relative to the application root. In development: `http://localhost:3000/api/...`

## Authentication

Currently, there is no authentication. All endpoints are publicly accessible. This is intentional for the MVP — interviews are accessed via unguessable UUID URLs.

---

## Candidates

### `POST /api/candidates`

Create a new candidate.

**Request Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "skills": ["React", "Node.js", "TypeScript"],
  "experienceYears": 5,
  "cv": "Full-stack developer with 5 years experience..."
}
```

**Required fields:** `name`, `email`, `skills`  
**Optional fields:** `experienceYears`, `cv`

**Response:**

```json
{
  "id": "uuid",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "skills": ["React", "Node.js", "TypeScript"],
  "experienceYears": 5,
  "cv": "Full-stack developer...",
  "createdAt": "2026-08-08T12:00:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Validation error (missing required fields)
- `500` — Database error

---

## Positions

### `POST /api/positions`

Create a new position.

**Request Body:**

```json
{
  "title": "Senior Full Stack Engineer",
  "level": "Senior",
  "jobDescription": "We are looking for a senior engineer to lead our platform team...",
  "requirements": ["React", "Node.js", "PostgreSQL", "System Design"]
}
```

**Required fields:** `title`, `level`, `requirements`  
**Optional fields:** `jobDescription`
**Response:**

```json
{
  "id": "uuid",
  "title": "Senior Full Stack Engineer",
  "level": "Senior",
  "jobDescription": "We are looking for a senior engineer to lead our platform team...",
  "requirements": ["React", "Node.js", "PostgreSQL", "System Design"],
  "createdAt": "2026-08-08T12:00:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Validation error
- `500` — Database error

### `GET /api/positions/:id`

Fetch a single position.

**Response:** Same shape as `POST` response.

**Status Codes:**
- `200` — Success
- `404` — Position not found

### `PATCH /api/positions/:id`

Update a position. Blocked if the position is referenced by any interview session.

**Request Body:**

```json
{
  "title": "Senior Full Stack Engineer",
  "level": "Senior",
  "jobDescription": "Updated description...",
  "requirements": ["React", "Node.js", "PostgreSQL", "System Design"]
}
```

**Status Codes:**
- `200` — Updated
- `404` — Position not found
- `409` — Conflict: position is referenced by existing sessions

### `DELETE /api/positions/:id`

Delete a position. Blocked if referenced by any session.

**Status Codes:**
- `200` — Deleted
- `404` — Position not found
- `409` — Conflict: position is referenced by existing sessions

---

## Candidates

### `POST /api/candidates`

Create a new candidate.

**Request Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "skills": ["React", "Node.js", "TypeScript"],
  "experienceYears": 5,
  "cv": "Full-stack developer with 5 years experience..."
}
```

**Required fields:** `name`, `email`, `skills`  
**Optional fields:** `experienceYears`, `cv`

**Response:**

```json
{
  "id": "uuid",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "skills": ["React", "Node.js", "TypeScript"],
  "experienceYears": 5,
  "cv": "Full-stack developer...",
  "createdAt": "2026-08-08T12:00:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Validation error
- `500` — Database error

### `GET /api/candidates/:id`

Fetch a single candidate.

**Response:** Same shape as `POST` response.

**Status Codes:**
- `200` — Success
- `404` — Candidate not found

### `PATCH /api/candidates/:id`

Update a candidate. Blocked if the candidate is referenced by any interview session.

**Request Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "skills": ["React", "Node.js", "TypeScript"],
  "experienceYears": 5,
  "cv": "Updated resume..."
}
```

**Status Codes:**
- `200` — Updated
- `404` — Candidate not found
- `409` — Conflict: candidate is referenced by existing sessions

### `DELETE /api/candidates/:id`

Delete a candidate. Blocked if referenced by any session.

**Status Codes:**
- `200` — Deleted
- `404` — Candidate not found
- `409` — Conflict: candidate is referenced by existing sessions

---

## Sessions

### `POST /api/sessions`

Create a new interview session.

**Request Body:**

```json
{
  "positionId": "uuid",
  "candidateId": "uuid"
}
```

**Required fields:** `positionId`, `candidateId`  
**Response:**

```json
{
  "id": "uuid",
  "positionId": "uuid",
  "candidateId": "uuid",
  "status": "created",
  "maxTurns": 8,
  "currentTurn": 0,
  "createdAt": "2026-08-08T12:00:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Missing positionId or candidateId
- `500` — Database error

### `GET /api/sessions`

List all sessions (used by dashboard).

**Response:**

```json
[
  {
    "id": "uuid",
    "status": "completed",
    "maxTurns": 8,
    "currentTurn": 8,
    "createdAt": "2026-08-08T12:00:00Z",
    "completedAt": "2026-08-08T12:15:00Z",
    "candidate": {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@example.com"
    },
    "position": {
      "id": "uuid",
      "title": "Senior Full Stack Engineer",
      "level": "Senior"
    },
    "evaluation": {
      "overallScore": 4,
      "recommendation": "yes"
    }
  }
]
```

### `GET /api/sessions/:id`

Get a single session with all related data.

**Response:**

```json
{
  "session": {
    "id": "uuid",
    "status": "completed",
    "maxTurns": 8,
    "currentTurn": 8,
    "createdAt": "2026-08-08T12:00:00Z",
    "completedAt": "2026-08-08T12:15:00Z"
  },
  "candidate": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "skills": ["React", "Node.js"],
    "experienceYears": 5
  },
  "position": {
    "id": "uuid",
    "title": "Senior Full Stack Engineer",
    "level": "Senior",
    "requirements": ["React", "Node.js", "PostgreSQL"]
  },
  "messages": [
    {
      "id": "uuid",
      "role": "interviewer",
      "content": "What is your experience with React?",
      "createdAt": "2026-08-08T12:01:00Z"
    },
    {
      "id": "uuid",
      "role": "candidate",
      "content": "I've been using React for 5 years...",
      "createdAt": "2026-08-08T12:02:00Z"
    }
  ]
}
```

**Status Codes:**
- `200` — Success
- `404` — Session not found

---

## Messages

### `POST /api/messages`

Submit a candidate answer or trigger the first question. Returns a streaming response.

**Request Body:**

```json
// First question (no content)
{
  "sessionId": "uuid"
}

// Subsequent answer
{
  "sessionId": "uuid",
  "content": "I've been using React for 5 years..."
}
```

**Response:**

Returns a `ReadableStream` of NDJSON chunks (when `stream: true`):

```
{"message": {"content": "What"}}
{"message": {"content": " is"}}
{"message": {"content": " your"}}
...
```

**Status Codes:**
- `200` — Stream started
- `400` — Missing sessionId or invalid request
- `404` — Session not found
- `500` — Ollama error

**Important:** This endpoint returns a stream, not a JSON object. The client must use `res.body.getReader()` to consume it.

---

## Evaluations

### `GET /api/evaluations/:sessionId`

Get the latest evaluation and version history for a completed session.

**Response:**

```json
{
  "latest": {
    "id": "uuid",
    "sessionId": "uuid",
    "model": "llama3.1",
    "aiScores": {
      "technicalDepth": 4,
      "communicationClarity": 4,
      "problemSolving": 3,
      "relevanceToRole": 5
    },
    "humanScores": {
      "technicalDepth": 4,
      "communicationClarity": 5,
      "problemSolving": 4,
      "relevanceToRole": 5
    },
    "aiRecommendation": "yes",
    "humanRecommendation": "yes",
    "humanCalibrated": true,
    "confidence": 82,
    "strengths": ["Strong React knowledge", "Clear communication"],
    "weaknesses": ["Could dig deeper into system design"],
    "recruiterNotes": "Strong candidate, recommend follow-up on system design",
    "rawResponse": "{\"technical_depth\": 4, ...}",
    "createdAt": "2026-08-08T12:20:00Z"
  },
  "versions": [
    {
      "id": "uuid",
      "model": "llama3.1",
      "humanCalibrated": true,
      "createdAt": "2026-08-08T12:20:00Z"
    }
  ]
}
```

**Status Codes:**
- `200` — Success
- `404` — Evaluation not found

### `GET /api/evaluations/versions/:versionId`

Get a specific evaluation version by ID.

**Response:** Same shape as `latest` above.

**Status Codes:**
- `200` — Success
- `404` — Version not found

### `POST /api/sessions/:id/evaluate`

Generate a new evaluation for a completed session. Creates a new version — never overwrites existing evaluations.

**Request Body (optional):**

```json
{
  "model": "llama3.2"
}
```

**Response:** The raw evaluation version row (same fields as `latest`).

**Status Codes:**
- `200` — Evaluation generated
- `400` — Interview not completed
- `404` — Session not found
- `500` — Ollama error or parse failure

### `PATCH /api/evaluations/:sessionId`

Update human calibration scores, human recommendation, and recruiter notes on the latest evaluation version.

**Request Body:**

```json
{
  "humanScores": {
    "technicalDepth": 4,
    "communicationClarity": 5,
    "problemSolving": 4,
    "relevanceToRole": 5
  },
  "humanRecommendation": "yes",
  "recruiterNotes": "Strong candidate, recommend follow-up on system design"
}
```

**Response:** Updated `{ latest: {...} }` object.

### `DELETE /api/evaluations/versions/:versionId`

Delete a non-latest evaluation version.

**Status Codes:**
- `200` — Success
- `400` — Cannot delete the latest version
- `404` — Version not found

---

## Campaigns

### `POST /api/campaigns`

Create a new recruiting campaign.

**Request Body:**

```json
{
  "name": "Q3 2026 Engineering Hiring",
  "description": "Fall hiring push for backend and frontend roles",
  "startDate": "2026-07-01",
  "endDate": "2026-09-30",
  "tags": ["engineering", "urgent"],
  "positionIds": ["uuid-1", "uuid-2"]
}
```

**Required fields:** `name`  
**Optional fields:** `description`, `startDate`, `endDate`, `tags`, `positionIds`, `status`

**Response:**

```json
{
  "id": "uuid",
  "name": "Q3 2026 Engineering Hiring",
  "description": "Fall hiring push...",
  "startDate": "2026-07-01T00:00:00.000Z",
  "endDate": "2026-09-30T00:00:00.000Z",
  "tags": ["engineering", "urgent"],
  "status": "draft",
  "createdAt": "2026-08-09T12:00:00Z"
}
```

**Status Codes:**
- `201` — Created
- `400` — Validation error (missing name)
- `500` — Database error

---

### `GET /api/campaigns`

List all campaigns with aggregated metrics.

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Q3 2026 Engineering Hiring",
    "description": "Fall hiring push...",
    "startDate": "2026-07-01T00:00:00.000Z",
    "endDate": "2026-09-30T00:00:00.000Z",
    "tags": ["engineering", "urgent"],
    "status": "draft",
    "createdAt": "2026-08-09T12:00:00Z",
    "positionCount": 2,
    "sessionCount": 5
  }
]
```

---

### `GET /api/campaigns/:id`

Fetch a single campaign with its positions and aggregated report.

**Response:**

```json
{
  "campaign": {
    "id": "uuid",
    "name": "Q3 2026 Engineering Hiring",
    "description": "Fall hiring push...",
    "startDate": "2026-07-01T00:00:00.000Z",
    "endDate": "2026-09-30T00:00:00.000Z",
    "tags": ["engineering", "urgent"],
    "status": "draft",
    "createdAt": "2026-08-09T12:00:00Z"
  },
  "positions": [
    {
      "id": "uuid",
      "title": "Senior Full Stack Engineer",
      "level": "Senior",
      "requirements": ["React", "Node.js"],
      "createdAt": "2026-08-09T12:00:00Z",
      "sessionCount": 3
    }
  ],
  "report": {
    "totalSessions": 5,
    "completedSessions": 4,
    "completionRate": 80,
    "avgAiScore": 3.8,
    "avgHumanScore": 4.2,
    "recommendationCounts": {
      "strong_yes": 1,
      "yes": 2,
      "maybe": 1
    },
    "topCandidates": [
      {
        "sessionId": "uuid",
        "candidateName": "Jane Doe",
        "aiAvg": 4.5,
        "humanAvg": 4.8,
        "recommendation": "strong_yes"
      }
    ]
  }
}
```

**Status Codes:**
- `200` — Success
- `404` — Campaign not found

---

### `PATCH /api/campaigns/:id`

Update a campaign.

**Request Body:**

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "startDate": "2026-08-01",
  "endDate": "2026-10-31",
  "tags": ["engineering"],
  "status": "active"
}
```

**Status Codes:**
- `200` — Updated
- `404` — Campaign not found
- `500` — Database error

---

### `DELETE /api/campaigns/:id`

Delete a campaign. Also deletes associated `campaign_positions` rows via CASCADE.

**Status Codes:**
- `200` — Deleted
- `404` — Campaign not found
- `500` — Database error

---

### `POST /api/campaigns/:id/positions`

Add a position to a campaign.

**Request Body:**

```json
{
  "positionId": "uuid"
}
```

**Status Codes:**
- `201` — Added
- `400` — Missing positionId
- `500` — Database error

---

### `DELETE /api/campaigns/:id/positions?positionId=uuid`

Remove a position from a campaign.

**Status Codes:**
- `200` — Removed
- `400` — Missing positionId query param
- `500` — Database error

---

## Error Format

All API errors follow this structure:

```json
{
  "error": "Human-readable error message"
}
```

**Common HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation error) |
| `404` | Not Found |
| `500` | Internal Server Error |
| `502` | Bad Gateway (Ollama returned invalid response) |
| `504` | Gateway Timeout (Ollama request timed out) |

## Rate Limiting

Currently, there is no rate limiting. This is acceptable for local/internal use but should be added before public deployment.
