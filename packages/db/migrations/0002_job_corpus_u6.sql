ALTER TABLE "source_register" ADD COLUMN "enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TYPE "public"."job_source_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_poster_type" AS ENUM('direct', 'consultancy', 'confidential', 'aggregator', 'unknown');--> statement-breakpoint
CREATE TABLE "job_source_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"status" "job_source_run_status" DEFAULT 'queued' NOT NULL,
	"actor_id" text,
	"actor_run_id" text,
	"dataset_id" text,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"jobs_fetched" integer DEFAULT 0 NOT NULL,
	"jobs_upserted" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"source_run_id" uuid NOT NULL,
	"provider_job_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_url" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parser_version" text DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text,
	"company_name" text NOT NULL,
	"company_domain" text,
	"location" text,
	"work_mode" text,
	"employment_type" text,
	"seniority" text,
	"description_text" text DEFAULT '' NOT NULL,
	"source_url" text,
	"application_url" text,
	"posted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"poster_type" "job_poster_type" DEFAULT 'unknown' NOT NULL,
	"trust_score" integer DEFAULT 0 NOT NULL,
	"trust_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quarantined" boolean DEFAULT true NOT NULL,
	"stale" boolean DEFAULT false NOT NULL,
	"invited_email" text,
	"invited_email_span" text,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"algorithm_version" text DEFAULT 'job-trust-1' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_source_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_job_id" uuid NOT NULL,
	"raw_job_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gate_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_job_id" uuid NOT NULL,
	"overall_pass" boolean NOT NULL,
	"decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skip_reason" text,
	"algorithm_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"draft_hash" text,
	"specificity" integer DEFAULT 0 NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"approved_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raw_jobs" ADD CONSTRAINT "raw_jobs_source_run_id_job_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."job_source_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source_links" ADD CONSTRAINT "job_source_links_canonical_job_id_canonical_jobs_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source_links" ADD CONSTRAINT "job_source_links_raw_job_id_raw_jobs_id_fk" FOREIGN KEY ("raw_job_id") REFERENCES "public"."raw_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_decisions" ADD CONSTRAINT "gate_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_decisions" ADD CONSTRAINT "gate_decisions_canonical_job_id_canonical_jobs_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_drafts" ADD CONSTRAINT "campaign_drafts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_drafts" ADD CONSTRAINT "campaign_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raw_jobs_source_provider_uidx" ON "raw_jobs" USING btree ("source_key","provider_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_jobs_fingerprint_uidx" ON "canonical_jobs" USING btree ("fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "job_source_links_raw_uidx" ON "job_source_links" USING btree ("raw_job_id");--> statement-breakpoint
UPDATE "source_register" SET "enabled" = true, "legal_status" = 'pilot_operator_accepted', "kill_switch" = false, "updated_at" = now() WHERE "source_key" = 'naukri_apify';--> statement-breakpoint
INSERT INTO "source_register" ("source_key", "display_name", "jurisdiction", "legal_status", "kill_switch", "enabled", "notes")
VALUES (
  'linkedin_apify',
  'LinkedIn via Apify actor',
  'IN',
  'pilot_operator_accepted',
  false,
  true,
  'Jobs and identity evidence only; never an email source. See docs/SOURCE-REGISTER.md'
)
ON CONFLICT ("source_key") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "kill_switch" = EXCLUDED."kill_switch",
  "legal_status" = EXCLUDED."legal_status",
  "updated_at" = now();
