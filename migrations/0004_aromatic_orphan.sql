CREATE TABLE "campaign_positions" (
	"campaign_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_versions" (
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
--> statement-breakpoint
ALTER TABLE "campaign_positions" ADD CONSTRAINT "campaign_positions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_positions" ADD CONSTRAINT "campaign_positions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_positions_campaign_idx" ON "campaign_positions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_positions_position_idx" ON "campaign_positions" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "evaluation_versions_session_idx" ON "evaluation_versions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "evaluation_versions_created_idx" ON "evaluation_versions" USING btree ("created_at");