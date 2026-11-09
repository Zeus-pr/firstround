CREATE TYPE "public"."onboarding_step" AS ENUM('account', 'cv', 'readiness', 'preferences', 'gmail', 'done');--> statement-breakpoint
CREATE TABLE "cv_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text,
	"original_filename" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cv_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cv_document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"schema_version" text NOT NULL,
	"model_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cv_readiness_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cv_document_id" uuid NOT NULL,
	"extraction_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sendability" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"algorithm_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"job_families" text[] DEFAULT '{}' NOT NULL,
	"locations" text[] DEFAULT '{}' NOT NULL,
	"target_level" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"onboarding_step" "onboarding_step" DEFAULT 'account' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_documents" ADD CONSTRAINT "cv_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_extractions" ADD CONSTRAINT "cv_extractions_cv_document_id_cv_documents_id_fk" FOREIGN KEY ("cv_document_id") REFERENCES "public"."cv_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_extractions" ADD CONSTRAINT "cv_extractions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_readiness_scores" ADD CONSTRAINT "cv_readiness_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_readiness_scores" ADD CONSTRAINT "cv_readiness_scores_cv_document_id_cv_documents_id_fk" FOREIGN KEY ("cv_document_id") REFERENCES "public"."cv_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_readiness_scores" ADD CONSTRAINT "cv_readiness_scores_extraction_id_cv_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."cv_extractions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;