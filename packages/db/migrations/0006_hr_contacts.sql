CREATE TABLE IF NOT EXISTS "hr_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "title" text,
  "company_name" text NOT NULL,
  "company_key" text NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hr_contacts_email_uidx" ON "hr_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hr_contacts_company_key_idx" ON "hr_contacts" USING btree ("company_key");
