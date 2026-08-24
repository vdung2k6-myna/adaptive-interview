## Requirement: Ollama chat responses stream token-by-token

The system SHALL consume Ollama's `/api/chat` streaming response and forward tokens to the frontend incrementally.

#### Scenario: Interviewer question streams to candidate
- **WHEN** the system generates a follow-up question via Ollama
- **THEN** the candidate sees the question text appear word-by-word rather than all at once

#### Scenario: First question also streams
- **WHEN** the system generates the first interview question
- **THEN** the candidate sees the question text appear word-by-word

## Requirement: Streaming response is accumulated server-side before persistence

The system SHALL accumulate the complete streamed text server-side and persist it to the `messages` table only after the stream completes.

#### Scenario: Stream completes successfully
- **WHEN** an Ollama stream produces the full text "Can you describe your experience with React?"
- **THEN** the messages table contains one row with that exact content

#### Scenario: Stream is interrupted
- **WHEN** an Ollama stream is interrupted mid-generation
- **THEN** no partial message is written to the messages table

## Requirement: Frontend renders streamed tokens live

The interview page SHALL consume the server's streamed response and update the interviewer message content in real-time.

#### Scenario: Candidate watches interviewer "type"
- **WHEN** the candidate submits an answer
- **THEN** a new interviewer message bubble appears immediately (empty)
- **AND** its content fills in token-by-token as the server streams data

## Requirement: Error during streaming is surfaced to candidate

If the Ollama stream fails or the connection is lost, the frontend SHALL display an error and allow the candidate to retry.

#### Scenario: Ollama stream errors mid-response
- **WHEN** the server is streaming tokens and Ollama returns an error
- **THEN** the frontend displays "Failed to generate question. Please try again."
- **AND** the partial text is discarded (not persisted)

#### Scenario: Connection lost during stream
- **WHEN** the browser disconnects from the server mid-stream
- **THEN** the frontend displays a connection error
- **AND** no partial message exists in the database

## Requirement: Existing non-streaming endpoint behavior is preserved

The `/api/messages` endpoint SHALL continue to handle all pre-stream logic identically: session validation, candidate message storage, embedding generation, prompt building, and coverage querying.

#### Scenario: Pre-stream logic unchanged
- **WHEN** a candidate submits an answer
- **THEN** the candidate message is stored, embedding is generated, and prompt is built before streaming begins
- **AND** the database state after the request completes matches the current non-streaming behavior
