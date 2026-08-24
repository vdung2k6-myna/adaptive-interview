## Requirement: Completed interviews can be evaluated by AI

The system SHALL provide an endpoint that triggers an AI evaluation of a completed interview session. The evaluation SHALL be persisted and retrievable.

#### Scenario: Recruiter requests evaluation
- **WHEN** a recruiter visits the transcript page for a completed interview
- **THEN** the system offers to generate an AI evaluation if one does not exist
- **AND** the evaluation is stored and displayed after generation

#### Scenario: Evaluation already exists
- **WHEN** a recruiter views a transcript that already has an evaluation
- **THEN** the stored evaluation is displayed immediately without re-calling Ollama

## Requirement: AI evaluation returns structured scores

The evaluation SHALL include dimensioned scores, a recommendation, and confidence level.

#### Scenario: Ollama returns valid JSON
- **WHEN** the evaluation prompt is sent to Ollama
- **THEN** the response is parsed into:
  - `technical_depth` (1-5)
  - `communication_clarity` (1-5)
  - `problem_solving` (1-5)
  - `relevance_to_role` (1-5)
  - `strengths` (string array)
  - `weaknesses` (string array)
  - `recommendation` (enum: strong_yes, yes, maybe, no, strong_no)
  - `confidence` (0-100)

#### Scenario: Ollama returns malformed JSON
- **WHEN** the evaluation response cannot be parsed as valid JSON
- **THEN** the raw response is stored, all structured fields are set to null
- **AND** the recruiter sees a "Evaluation failed to parse" message with the raw text

## Requirement: Dashboard lists all interview sessions

The recruiter dashboard SHALL display a paginated list of all interview sessions with key metadata.

#### Scenario: Recruiter views dashboard
- **WHEN** a recruiter navigates to `/dashboard`
- **THEN** they see a table of sessions with candidate name, position title, status, and completion info
- **AND** the list is ordered by most recently updated

#### Scenario: Filter by status
- **WHEN** a recruiter selects "Completed" from a status filter
- **THEN** only sessions with `status = 'completed'` are shown

## Requirement: Transcript page displays full conversation

Each session SHALL have a read-only transcript page accessible to the recruiter.

#### Scenario: Recruiter views transcript
- **WHEN** a recruiter navigates to `/interview/[id]/transcript`
- **THEN** they see the full message history with interviewer questions and candidate answers
- **AND** messages are displayed in chronological order

## Requirement: Recruiter can add manual notes to evaluation

The system SHALL allow recruiters to append free-text notes to an AI evaluation.

#### Scenario: Recruiter adds note
- **WHEN** a recruiter types a note into the "Recruiter notes" field and saves
- **THEN** the note is stored in the `recruiter_notes` column of the evaluations table
- **AND** the note is visible on the transcript page

## Requirement: Comparison view for candidates on the same position

The system SHALL support viewing multiple candidates for the same position side-by-side.

#### Scenario: Recruiter compares two candidates
- **WHEN** a recruiter selects two completed sessions for the same position
- **THEN** a comparison view shows both candidates' coverage and evaluation scores side-by-side
