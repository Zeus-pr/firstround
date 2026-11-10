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
import {
  EMPTY_PREFERENCES_CRITERIA,
  PreferencesCriteria,
  type PreferencesPayload,
  type SessionUser,
} from '@firstround/contracts';
import { DB } from '../db/db.module.js';
import { scoreSpecificity } from './draft.js';
import { rankMatches, type MatchableJob } from './match.js';

const EMPTY_PREFS: PreferencesPayload = {
  jobFamilies: [],
  locations: [],
  targetLevel: null,
  links: {},
  criteria: EMPTY_PREFERENCES_CRITERIA,
};

function eveningCutoff(now = new Date()): Date {
  return new Date(now.getTime() + 12 * 60 * 60_000);
}

function prefsFromRow(row: {
  jobFamilies: string[] | null;
  locations: string[] | null;
  targetLevel: string | null;
  links: Record<string, string> | null;
  criteria: Record<string, unknown> | null;
}): PreferencesPayload {
  const criteriaParsed = PreferencesCriteria.safeParse({
    ...EMPTY_PREFERENCES_CRITERIA,
    ...(row.criteria ?? {}),
  });
  return {
    jobFamilies: row.jobFamilies ?? [],
    locations: row.locations ?? [],
    targetLevel: row.targetLevel ?? null,
    links: (row.links ?? {}) as PreferencesPayload['links'],
    criteria: criteriaParsed.success ? criteriaParsed.data : EMPTY_PREFERENCES_CRITERIA,
  };
}

/** Plain letter — short, specific, no “AI assistant” cadence. */
function draftBody(opts: {
  company: string;
  role: string;
  location: string | null;
  skills: string[];
}): string {
  const where = opts.location ? ` in ${opts.location}` : '';
  const skillBits = opts.skills
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
  const skillLine =
    skillBits.length === 2
      ? ` I've been working with ${skillBits[0]} and ${skillBits[1]}.`
      : skillBits.length === 1
        ? ` I've been working with ${skillBits[0]}.`
        : '';
  return (
    `Hi — I'm reaching out about the ${opts.role} opening at ${opts.company}${where}.` +
    skillLine +
    ` I'd welcome a short conversation if the timing works.`
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
    const prefs: PreferencesPayload = prefsRow ? prefsFromRow(prefsRow) : EMPTY_PREFS;

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
      employmentType: r.employmentType,
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
        message: 'No openings ready yet. Try again later today.',
        readinessTotal: latestScore.total,
      };
    }

    const ranked = rankMatches(prefs, matchable, { minMatch: 48, limit: 5 });
    if (ranked.length === 0) {
      return {
        ok: true as const,
        created: 0,
        considered: matchable.length,
        drafts: [],
        message:
          'Nothing close enough yet. Loosen a preference or try again after new openings land.',
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

      const skillFacts = hit.job.skills.slice(0, 3).filter(Boolean);
      const body = draftBody({
        company: hit.job.companyName,
        role: hit.job.title,
        location: hit.job.location,
        skills: skillFacts,
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
            match: 'desk-match-2',
            readiness: String(latestScore.total),
          },
        })
        .returning();
      if (!campaign) continue;

      const evidence = {
        company: hit.job.companyName,
        role: hit.job.title,
        person: '',
        evidenceFacts: [hit.job.location, ...skillFacts].filter((v): v is string => Boolean(v)),
      };
      const specificity = scoreSpecificity(body, evidence);

      const [draft] = await db
        .insert(campaignDrafts)
        .values({
          campaignId: campaign.id,
          userId: user.id,
          body,
          specificity,
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
          : 'Those openings already have a letter on your desk.',
      readinessTotal: latestScore.total,
    };
  }
}
