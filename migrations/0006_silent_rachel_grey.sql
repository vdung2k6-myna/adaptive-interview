ALTER TABLE "interview_sessions" ADD COLUMN "mode" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_format" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "stt_confidence" integer;