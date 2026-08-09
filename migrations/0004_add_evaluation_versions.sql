CREATE TABLE IF NOT EXISTS "evaluation_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"model" text NOT NULL,
	"raw_response" text NOT NULL,

	"ai_technical_depth" integer,
	"ai_communication_clarity" integer,
	"ai_problem_solving" integer,
	"ai_relevance_to_role" integer,
	"ai_recommendation" text,
	"ai_confidence" integer,

	"human_technical_depth" integer,
	"human_communication_clarity" integer,
	"human_problem_solving" integer,
	"human_relevance_to_role" integer,
	"human_recommendation" text,

	"strengths" text[] DEFAULT '{}' NOT NULL,
	"weaknesses" text[] DEFAULT '{}' NOT NULL,

	"recruiter_notes" text,
	"human_calibrated" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "evaluation_versions_session_idx" ON "evaluation_versions" ("session_id");
CREATE INDEX IF NOT EXISTS "evaluation_versions_created_idx" ON "evaluation_versions" ("created_at");
