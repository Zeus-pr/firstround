import { sql } from 'drizzle-orm';
import { createDb } from '@/db/client';
import { configRegistry, sourceRegister } from '@/db/schema';

async function main() {
  const db = createDb();

  await db
    .insert(configRegistry)
    .values([
      {
        key: 'job_trust_minimum',
        value: 75,
        owner: 'product',
        version: 1,
      },
      {
        key: 'job_match_minimum',
        value: 78,
        owner: 'product',
        version: 1,
      },
      {
        key: 'person_job_minimum',
        value: 80,
        owner: 'product',
        version: 1,
      },
      {
        key: 'mailbox_confidence_minimum',
        value: 90,
        owner: 'product',
        version: 1,
      },
      {
        key: 'cv_readiness_threshold',
        value: 85,
        owner: 'product',
        version: 1,
      },
    ])
    .onConflictDoNothing({ target: [configRegistry.key, configRegistry.version] });

  await db
    .insert(sourceRegister)
    .values([
      {
        sourceKey: 'naukri_apify',
        displayName: 'Naukri via Apify actor',
        jurisdiction: 'IN',
        legalStatus: 'pending_counsel',
        notes: 'See docs/SOURCE-REGISTER.md',
      },
      {
        sourceKey: 'company_careers_schema',
        displayName: 'Employer careers JobPosting JSON-LD',
        jurisdiction: 'IN',
        legalStatus: 'pending_counsel',
      },
      {
        sourceKey: 'invited_channel',
        displayName: 'Address published in the job post',
        jurisdiction: 'IN',
        legalStatus: 'pending_counsel',
      },
    ])
    .onConflictDoNothing({ target: sourceRegister.sourceKey });

  await db.execute(sql`select 1`);
  console.log('Seed complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
