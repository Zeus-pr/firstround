CREATE TABLE IF NOT EXISTS "desk_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "status" text NOT NULL,
  "message" text,
  "created_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "finished_at" timestamptz
);--> statement-breakpoint
ALTER TABLE "desk_runs" ADD CONSTRAINT "desk_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
