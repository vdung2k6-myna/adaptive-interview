-- Migrate existing evaluations into evaluation_versions
-- Existing rows become version 1 with human_calibrated = false

INSERT INTO "evaluation_versions" (
	"session_id",
	"model",
	"raw_response",
	"ai_technical_depth",
	"ai_communication_clarity",
	"ai_problem_solving",
	"ai_relevance_to_role",
	"ai_recommendation",
	"ai_confidence",
	"strengths",
	"weaknesses",
	"recruiter_notes",
	"human_calibrated",
	"created_at"
)
SELECT
	"session_id",
	COALESCE("model", 'llama3.1'),
	COALESCE("raw_response", ''),
	"technical_depth",
	"communication_clarity",
	"problem_solving",
	"relevance_to_role",
	"recommendation",
	"confidence",
	"strengths",
	"weaknesses",
	"recruiter_notes",
	false,
	COALESCE("created_at", now())
FROM "evaluations";
