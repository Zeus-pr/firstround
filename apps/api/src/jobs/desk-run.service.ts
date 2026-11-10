import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import {
  campaignDrafts,
  campaigns,
  canonicalJobs,
  cvReadinessScores,
  preferences,
  type Db,
} from '@firstround/db';
import type { PreferencesPayload, SessionUser } from '@firstround/contracts';
import { DB } from '../db/db.module.js';
import { rankMatches, type MatchableJob } from './match.js';

const EMPTY_PREFS: PreferencesPayload = {
  jobFamilies: [],
  locations: [],
  targetLevel: null,
  links: {},
};

function eveningCutoff(now = new Date()): Date {
  // Default: 12 hours from now (Review evening cutoff comes later as a real clock).
  return new Date(now.getTime() + 12 * 60 * 60_000);
}

function draftBody(opts: {
  company: string;
  role: string;
  location: string | null;
  sourceUrl: string | null;
}): string {
  const where = opts.location ? ` in ${opts.location}` : '';
  const link = opts.sourceUrl ? ` I saw the opening here: ${opts.sourceUrl}.` : '';
  return (
    `Hi — I am writing about the ${opts.role} role at ${opts.company}${where}.` +
    link +
    ` My background fits the role, and I would welcome a short conversation about how I could help.` +
    ` Happy to share a CV and more detail whenever useful.`
  );
}

@Injectable()
export class DeskRunService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  async runToday(user: SessionUser) {
    const db = this.ready();

    const [latestScore] = await db
      .select({
        total: cvReadinessScores.total,
        cvDocumentId: cvReadinessScores.cvDocumentId,
      })
      .from(cvReadinessScores)
      .where(eq(cvReadinessScores.userId, user.id))
      .orderBy(desc(cvReadinessScores.createdAt))
      .limit(1);

    if (!latestScore) {
      throw new BadRequestException('Upload a CV and get a score before starting your round.');
    }

    const [prefsRow] = await db
      .select()
      .from(preferences)
      .where(eq(preferences.userId, user.id))
      .limit(1);
    const prefs: PreferencesPayload = prefsRow
      ? {
          jobFamilies: prefsRow.jobFamilies ?? [],
          locations: prefsRow.locations ?? [],
          targetLevel: prefsRow.targetLevel ?? null,
          links: (prefsRow.links ?? {}) as PreferencesPayload['links'],
        }
      : EMPTY_PREFS;

    const rows = await db
      .select()
      .from(canonicalJobs)
      .where(and(eq(canonicalJobs.quarantined, false), eq(canonicalJobs.stale, false)))
      .orderBy(desc(canonicalJobs.trustScore), desc(canonicalJobs.lastSeenAt))
      .limit(200);

    const matchable: MatchableJob[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      companyName: r.companyName,
      location: r.location,
      workMode: r.workMode,
      seniority: r.seniority,
      descriptionText: r.descriptionText ?? '',
      skills: r.skills ?? [],
      trustScore: r.trustScore,
      sourceUrl: r.sourceUrl,
      invitedEmail: r.invitedEmail,
    }));

    if (matchable.length === 0) {
      return {
        ok: true as const,
        created: 0,
        considered: 0,
        drafts: [] as Array<{ draftId: string; campaignId: string; company: string; role: string }>,
        message: 'No openings in the shared corpus yet. Try again after today’s jobs refresh.',
        readinessTotal: latestScore.total,
      };
    }

    const ranked = rankMatches(prefs, matchable, { minMatch: 55, limit: 5 });
    if (ranked.length === 0) {
      return {
        ok: true as const,
        created: 0,
        considered: matchable.length,
        drafts: [],
        message:
          'No strong fits yet. Widen preferences or wait for a fresher job set, then start again.',
        readinessTotal: latestScore.total,
      };
    }

    const expiresAt = eveningCutoff();
    const created: Array<{ draftId: string; campaignId: string; company: string; role: string }> =
      [];

    for (const hit of ranked) {
      const existing = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(and(eq(campaigns.userId, user.id), eq(campaigns.jobCanonicalId, hit.job.id)))
        .limit(1);
      if (existing[0]) continue;

      const body = draftBody({
        company: hit.job.companyName,
        role: hit.job.title,
        location: hit.job.location,
        sourceUrl: hit.job.sourceUrl,
      });

      const [campaign] = await db
        .insert(campaigns)
        .values({
          workspaceId: user.workspaceId,
          userId: user.id,
          state: 'pending_approval',
          jobCanonicalId: hit.job.id,
          recipientEmail: hit.job.invitedEmail,
          policyVersions: {
            match: 'desk-match-1',
            readiness: String(latestScore.total),
          },
        })
        .returning();
      if (!campaign) continue;

      const evidence = {
        company: hit.job.companyName,
        role: hit.job.title,
        person: hit.job.invitedEmail ? 'Hiring contact' : 'Hiring team',
        evidenceFacts: [
          hit.job.location ?? 'India',
          ...hit.job.skills.slice(0, 4),
          `match ${hit.matchScore}`,
          ...hit.reasons.slice(0, 3),
        ].filter(Boolean),
      };

      const [draft] = await db
        .insert(campaignDrafts)
        .values({
          campaignId: campaign.id,
          userId: user.id,
          body,
          specificity: 0,
          evidence,
          status: 'pending_approval',
          expiresAt,
        })
        .returning();
      if (!draft) continue;

      created.push({
        draftId: draft.id,
        campaignId: campaign.id,
        company: hit.job.companyName,
        role: hit.job.title,
      });
    }

    return {
      ok: true as const,
      created: created.length,
      considered: matchable.length,
      drafts: created,
      message:
        created.length > 0
          ? `Found ${created.length} fit${created.length === 1 ? '' : 's'} for you to review.`
          : 'Those openings already have a campaign on your desk.',
      readinessTotal: latestScore.total,
    };
  }
}
