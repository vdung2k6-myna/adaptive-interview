## ADDED Requirements

### Requirement: Position requirements are embedded at creation time
When a position is created, the system SHALL generate one embedding per requirement using the configured embedding model and store them in the embeddings table with `source_type = 'requirement'`.

#### Scenario: New position triggers embedding generation
- **WHEN** a recruiter creates a position with requirements `["React", "System design"]`
- **THEN** two rows exist in the `embeddings` table with `source_type = 'requirement'`, `source_id` pointing to the position, and 1024-dimension vectors for each requirement

### Requirement: Candidate messages are embedded on submission
When a candidate submits an answer in an interview session, the system SHALL generate an embedding for the message content and store it with `source_type = 'message'` and `source_id` pointing to the message.

#### Scenario: Message submitted during active interview
- **WHEN** a candidate sends the message `"I have 5 years of experience with React and TypeScript"` in a session
- **THEN** a row exists in the `embeddings` table with `source_type = 'message'`, `content` matching the message text, and a 1024-dimension vector

### Requirement: Coverage query returns fulfilled and remaining requirements
Given a session and its messages, the system SHALL compare requirement embeddings against message embeddings using cosine similarity and return which requirements have been addressed.

#### Scenario: Requirement is semantically covered
- **WHEN** a session contains a message embedding with cosine similarity ≥ 0.75 to the requirement embedding `"React development"`
- **THEN** the coverage query reports that requirement as fulfilled

#### Scenario: Requirement is not yet covered
- **WHEN** no message embedding in the session has cosine similarity ≥ 0.75 to the requirement embedding `"Kubernetes orchestration"`
- **THEN** the coverage query reports that requirement as remaining

#### Scenario: Synonym matching counts as coverage
- **WHEN** a session contains the message `"I deploy containers with Docker daily"` and the requirement is `"Containerization experience"`
- **THEN** the coverage query reports that requirement as fulfilled because the embedding similarity exceeds the threshold

### Requirement: Prompt builder uses semantic coverage data
The prompt builder SHALL query the database for fulfilled and remaining requirements instead of scanning messages with keyword matching.

#### Scenario: Interview question generation includes coverage context
- **WHEN** the system generates the next interview question for a session
- **THEN** the prompt includes a `Topics already covered` section listing fulfilled requirements and a `Remaining topics to explore` section listing uncovered requirements

### Requirement: Turn-critical-path embedding latency is bounded
The embedding generation for a candidate message SHALL complete within a configurable timeout and SHALL block question generation only for the duration of the embedding call.

#### Scenario: Ollama embedding responds within timeout
- **WHEN** a candidate submits an answer and Ollama returns the embedding within the timeout window
- **THEN** the next question is generated using the updated coverage data

#### Scenario: Ollama embedding times out
- **WHEN** a candidate submits an answer and the embedding request exceeds the timeout
- **THEN** the system returns an HTTP 504 error and does not generate a follow-up question
