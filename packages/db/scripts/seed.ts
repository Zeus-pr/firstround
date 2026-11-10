import { sql } from 'drizzle-orm';
import { createDb } from '../src/client';
import { configRegistry, sourceRegister } from '../src/schema';

async function main() {
  const { db, client } = createDb();

  try {
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
          notes: 'Pilot accepted for pilot. See docs/SOURCE-REGISTER.md',
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

    await db.execute(sql`select 1`);
    console.log('Seed complete');
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
