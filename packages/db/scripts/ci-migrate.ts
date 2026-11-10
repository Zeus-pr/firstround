/**
 * CI migrate + seed against in-process PGlite (no Docker Postgres service required for unit path).
 * Production/Railway still uses DATABASE_URL + scripts/migrate.ts.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import * as schema from '../src/schema';
import { configRegistry, sourceRegister } from '../src/schema';

const root = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(root, '..', 'migrations');

const client = new PGlite();
const db = drizzle(client, { schema });

await migrate(db, { migrationsFolder });
console.log('PGlite migrate ok');

await migrate(db, { migrationsFolder });
console.log('PGlite migrate second pass ok');

await db
  .insert(configRegistry)
  .values([
    { key: 'job_trust_minimum', value: 75, owner: 'product', version: 1 },
    { key: 'job_match_minimum', value: 78, owner: 'product', version: 1 },
    { key: 'person_job_minimum', value: 80, owner: 'product', version: 1 },
    { key: 'mailbox_confidence_minimum', value: 90, owner: 'product', version: 1 },
    { key: 'cv_readiness_threshold', value: 85, owner: 'product', version: 1 },
  ])
  .onConflictDoNothing();

await db
  .insert(sourceRegister)
  .values([
    {
      sourceKey: 'naukri_apify',
      displayName: 'Naukri via Apify actor',
      jurisdiction: 'IN',
      legalStatus: 'pilot_operator_accepted',
      killSwitch: false,
      enabled: true,
      notes: 'See docs/SOURCE-REGISTER.md',
    },
    {
      sourceKey: 'linkedin_apify',
      displayName: 'LinkedIn via Apify actor',
      jurisdiction: 'IN',
      legalStatus: 'pilot_operator_accepted',
      killSwitch: false,
      enabled: true,
      notes: 'Jobs/identity evidence only; never an email source.',
    },
    {
      sourceKey: 'company_careers_schema',
      displayName: 'Employer careers JobPosting JSON-LD',
      jurisdiction: 'IN',
      legalStatus: 'pending_counsel',
      killSwitch: false,
      enabled: false,
    },
    {
      sourceKey: 'invited_channel',
      displayName: 'Address published in the job post',
      jurisdiction: 'IN',
      legalStatus: 'pending_counsel',
      killSwitch: false,
      enabled: false,
    },
  ])
  .onConflictDoNothing();

await db.execute(sql`select count(*)::int as n from source_register`);
console.log('PGlite seed ok');
await client.close();
