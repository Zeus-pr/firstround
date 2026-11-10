CREATE TABLE IF NOT EXISTS "preference_catalog" (
  "kind" text NOT NULL,
  "label" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "preference_catalog_pk" PRIMARY KEY ("kind", "label")
);--> statement-breakpoint
