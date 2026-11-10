ALTER TABLE "preferences" ADD COLUMN IF NOT EXISTS "criteria" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint

