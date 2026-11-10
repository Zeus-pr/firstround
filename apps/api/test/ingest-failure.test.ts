import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@firstround/db';
import { JobsService } from '../src/jobs/jobs.service.js';

vi.mock('../src/jobs/apify.js', async () => {
  const actual =
    await vi.importActual<typeof import('../src/jobs/apify.js')>('../src/jobs/apify.js');
  return {
    ...actual,
    runApifyActorAndFetch: vi.fn(async () => {
      throw new Error('apify plan blocked');
    }),
  };
});

const migrationsFolder = path.join(process.cwd(), '../../packages/db/migrations');

describe('JobsService.startIngest failure', () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let jobs: JobsService;
  let jobId = '';

  beforeAll(async () => {
    process.env.APIFY_TOKEN = 'test-token';
    process.env.NODE_ENV = 'test';
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    jobs = new JobsService(db as never);

    await db.insert(schema.sourceRegister).values({
      sourceKey: 'naukri_apify',
      displayName: 'Naukri',
      legalStatus: 'pilot_operator_accepted',
      enabled: true,
      killSwitch: false,
    });
    const [job] = await db
      .insert(schema.canonicalJobs)
      .values({
        fingerprint: 'category-manager-acme',
        title: 'Category Manager',
        companyName: 'Acme',
        descriptionText: 'Own the category P&L and assortment.',
        trustScore: 80,
        quarantined: false,
        stale: false,
        algorithmVersion: 'job-trust-1',
      })
      .returning({ id: schema.canonicalJobs.id });
    jobId = job!.id;
    const [run] = await db
      .insert(schema.jobSourceRuns)
      .values({ sourceKey: 'naukri_apify', status: 'succeeded' })
      .returning({ id: schema.jobSourceRuns.id });
    const [raw] = await db
      .insert(schema.rawJobs)
      .values({
        sourceKey: 'naukri_apify',
        sourceRunId: run!.id,
        providerJobId: 'job-1',
      })
      .returning({ id: schema.rawJobs.id });
    await db.insert(schema.jobSourceLinks).values({
      canonicalJobId: jobId,
      rawJobId: raw!.id,
      sourceKey: 'naukri_apify',
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it('keeps already stored jobs searchable when the scrape fails', async () => {
    await expect(
      jobs.startIngest('naukri_apify', { keywords: 'category manager', maxJobs: 10 }),
    ).rejects.toMatchObject({ status: 503 });

    const [job] = await db
      .select({ stale: schema.canonicalJobs.stale, quarantined: schema.canonicalJobs.quarantined })
      .from(schema.canonicalJobs)
      .where(eq(schema.canonicalJobs.id, jobId));
    expect(job).toEqual({ stale: false, quarantined: false });
  });
});
