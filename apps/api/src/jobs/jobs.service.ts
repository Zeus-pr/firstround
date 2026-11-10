import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  canonicalJobs,
  jobSourceLinks,
  jobSourceRuns,
  rawJobs,
  sourceRegister,
  type Db,
} from '@firstround/db';
import { DB } from '../db/db.module.js';
import {
  actorForSource,
  apifyConfigured,
  buildActorInput,
  runApifyActorAndFetch,
} from './apify.js';
import {
  JOB_PARSER_VERSION,
  JOB_TRUST_VERSION,
  normalizeProviderJob,
  scoreJobTrust,
  type ProviderJobRow,
} from './normalize.js';
import { assertSourceRunnable } from './source-register.js';

export type IngestCluster = {
  keywords: string;
  location?: string;
  maxJobs?: number;
};

@Injectable()
export class JobsService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  async corpusStatus() {
    const db = this.ready();
    const [counts] = await db
      .select({
        canonical: sql<number>`count(*)::int`,
        quarantined: sql<number>`count(*) filter (where ${canonicalJobs.quarantined})::int`,
        stale: sql<number>`count(*) filter (where ${canonicalJobs.stale})::int`,
      })
      .from(canonicalJobs);
    const recent = await db
      .select({
        id: jobSourceRuns.id,
        sourceKey: jobSourceRuns.sourceKey,
        status: jobSourceRuns.status,
        jobsFetched: jobSourceRuns.jobsFetched,
        jobsUpserted: jobSourceRuns.jobsUpserted,
        error: jobSourceRuns.error,
        finishedAt: jobSourceRuns.finishedAt,
        createdAt: jobSourceRuns.createdAt,
      })
      .from(jobSourceRuns)
      .orderBy(desc(jobSourceRuns.createdAt))
      .limit(10);
    const sources = await db.select().from(sourceRegister);
    return {
      ok: true as const,
      counts: {
        canonical: counts?.canonical ?? 0,
        quarantined: counts?.quarantined ?? 0,
        stale: counts?.stale ?? 0,
      },
      sources: sources.map((s) => ({
        sourceKey: s.sourceKey,
        enabled: s.enabled,
        killSwitch: s.killSwitch,
        legalStatus: s.legalStatus,
      })),
      recentRuns: recent,
      apifyConfigured: apifyConfigured(),
    };
  }

  async listCanonical(opts: { limit?: number; includeQuarantined?: boolean } = {}) {
    const db = this.ready();
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const rows = opts.includeQuarantined
      ? await db.select().from(canonicalJobs).orderBy(desc(canonicalJobs.lastSeenAt)).limit(limit)
      : await db
          .select()
          .from(canonicalJobs)
          .where(and(eq(canonicalJobs.quarantined, false), eq(canonicalJobs.stale, false)))
          .orderBy(desc(canonicalJobs.trustScore), desc(canonicalJobs.lastSeenAt))
          .limit(limit);
    return { ok: true as const, jobs: rows };
  }

  async startIngest(sourceKey: string, cluster: IngestCluster) {
    if (!cluster.keywords?.trim()) {
      throw new BadRequestException('keywords is required');
    }
    if (!apifyConfigured()) {
      throw new ServiceUnavailableException('APIFY_TOKEN is not configured');
    }
    const db = this.ready();
    const [reg] = await db
      .select()
      .from(sourceRegister)
      .where(eq(sourceRegister.sourceKey, sourceKey))
      .limit(1);
    try {
      assertSourceRunnable(reg);
    } catch (error) {
      throw new ForbiddenException(error instanceof Error ? error.message : 'Source blocked');
    }

    const actorId = actorForSource(sourceKey);
    const input = buildActorInput(sourceKey, {
      keywords: cluster.keywords.trim(),
      location: cluster.location?.trim() || undefined,
      maxJobs: cluster.maxJobs,
    });

    const [run] = await db
      .insert(jobSourceRuns)
      .values({
        sourceKey,
        status: 'running',
        actorId,
        input,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (!run) throw new ServiceUnavailableException('Could not create source run');

    try {
      const result = await runApifyActorAndFetch({
        token: process.env.APIFY_TOKEN!.trim(),
        actorId,
        input,
      });
      const upserted = await this.ingestProviderRows({
        sourceKey,
        sourceRunId: run.id,
        rows: result.items,
      });

      await db
        .update(jobSourceRuns)
        .set({
          status: 'succeeded',
          actorRunId: result.actorRunId,
          datasetId: result.datasetId,
          jobsFetched: result.items.length,
          jobsUpserted: upserted,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobSourceRuns.id, run.id));

      return {
        ok: true as const,
        runId: run.id,
        actorRunId: result.actorRunId,
        jobsFetched: result.items.length,
        jobsUpserted: upserted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ingest_failed';
      await db
        .update(jobSourceRuns)
        .set({
          status: 'failed',
          error: message.slice(0, 500),
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobSourceRuns.id, run.id));

      // A failed scrape did not see the jobs close. Leave the corpus searchable.
      throw new ServiceUnavailableException(message);
    }
  }

  /** Ingest already-fetched provider rows (used by live Apify and by recorded live payloads in tests). */
  async ingestProviderRows(opts: {
    sourceKey: string;
    sourceRunId: string;
    rows: ProviderJobRow[];
  }): Promise<number> {
    const db = this.ready();
    let upserted = 0;
    for (const row of opts.rows) {
      const normalized = normalizeProviderJob(row);
      if (!normalized) continue;
      const trust = scoreJobTrust(normalized, opts.sourceKey);

      const [raw] = await db
        .insert(rawJobs)
        .values({
          sourceKey: opts.sourceKey,
          sourceRunId: opts.sourceRunId,
          providerJobId: normalized.providerJobId,
          payload: row as Record<string, unknown>,
          sourceUrl: normalized.sourceUrl,
          parserVersion: JOB_PARSER_VERSION,
        })
        .onConflictDoUpdate({
          target: [rawJobs.sourceKey, rawJobs.providerJobId],
          set: {
            payload: row as Record<string, unknown>,
            sourceUrl: normalized.sourceUrl,
            sourceRunId: opts.sourceRunId,
            capturedAt: new Date(),
          },
        })
        .returning();

      const [canonical] = await db
        .insert(canonicalJobs)
        .values({
          fingerprint: normalized.fingerprint,
          title: normalized.title,
          normalizedTitle: normalized.normalizedTitle,
          companyName: normalized.companyName,
          companyDomain: normalized.companyDomain,
          location: normalized.location,
          workMode: normalized.workMode,
          employmentType: normalized.employmentType,
          seniority: normalized.seniority,
          descriptionText: normalized.descriptionText,
          sourceUrl: normalized.sourceUrl,
          applicationUrl: normalized.applicationUrl,
          postedAt: normalized.postedAt,
          posterType: normalized.posterType,
          trustScore: trust.score,
          trustBreakdown: trust.breakdown,
          quarantined: trust.quarantined,
          stale: false,
          invitedEmail: normalized.invitedEmail,
          invitedEmailSpan: normalized.invitedEmailSpan,
          skills: normalized.skills,
          algorithmVersion: JOB_TRUST_VERSION,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: canonicalJobs.fingerprint,
          set: {
            title: normalized.title,
            normalizedTitle: normalized.normalizedTitle,
            companyDomain: normalized.companyDomain,
            location: normalized.location,
            workMode: normalized.workMode,
            employmentType: normalized.employmentType,
            seniority: normalized.seniority,
            descriptionText: normalized.descriptionText,
            sourceUrl: normalized.sourceUrl,
            applicationUrl: normalized.applicationUrl,
            postedAt: normalized.postedAt,
            posterType: normalized.posterType,
            trustScore: trust.score,
            trustBreakdown: trust.breakdown,
            quarantined: trust.quarantined,
            stale: false,
            invitedEmail: normalized.invitedEmail,
            invitedEmailSpan: normalized.invitedEmailSpan,
            skills: normalized.skills,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!raw || !canonical) continue;

      await db
        .insert(jobSourceLinks)
        .values({
          canonicalJobId: canonical.id,
          rawJobId: raw.id,
          sourceKey: opts.sourceKey,
          sourceUrl: normalized.sourceUrl,
        })
        .onConflictDoNothing();

      upserted += 1;
    }
    return upserted;
  }
}
