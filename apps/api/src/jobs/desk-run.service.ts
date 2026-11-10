import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, ilike, not, or } from 'drizzle-orm';
import {
  campaignDrafts,
  campaigns,
  canonicalJobs,
  cvExtractions,
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
import { createGrokClient } from '../cv/grok-extract.js';
import { DB } from '../db/db.module.js';
import { scoreSpecificity, type DraftEvidence } from './draft.js';
import { composeLetter, finalizeLetter, polishLetter, type LetterCv } from './letter.js';
import { rankMatches, type MatchableJob } from './match.js';
import { primaryFamily, titleConstraints, type RoleFamily } from './role-family.js';

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

function titleWhere(family: RoleFamily) {
  const spec = titleConstraints(family);
  if (!spec) return undefined;
  const include = or(...spec.include.map((needle) => ilike(canonicalJobs.title, `%${needle}%`)));
  const exclude = spec.exclude.map((needle) => not(ilike(canonicalJobs.title, `%${needle}%`)));
  return and(include, ...exclude);
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
        extractionId: cvReadinessScores.extractionId,
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

    const [extraction] = await db
      .select({ facts: cvExtractions.facts })
      .from(cvExtractions)
      .where(and(eq(cvExtractions.id, latestScore.extractionId), eq(cvExtractions.userId, user.id)))
      .limit(1);
    const cv = (extraction?.facts ?? {}) as LetterCv;
    const family = primaryFamily(cv);
    const titleFilter = titleWhere(family);

    const rows = await db
      .select()
      .from(canonicalJobs)
      .where(
        and(
          ...[
            eq(canonicalJobs.quarantined, false),
            eq(canonicalJobs.stale, false),
            titleFilter,
          ].filter((clause) => clause != null),
        ),
      )
      .orderBy(desc(canonicalJobs.lastSeenAt), desc(canonicalJobs.trustScore))
      .limit(120);

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
        message: 'No openings close to your work yet. Try again after more roles land.',
        readinessTotal: latestScore.total,
      };
    }

    const ranked = rankMatches(prefs, matchable, {
      minMatch: family === 'other' ? 48 : 55,
      limit: 5,
      primaryFamily: family,
    });
    if (ranked.length === 0) {
      return {
        ok: true as const,
        created: 0,
        considered: matchable.length,
        drafts: [],
        message: 'Nothing close to your current work yet. Try again after more openings land.',
        readinessTotal: latestScore.total,
      };
    }

    const expiresAt = eveningCutoff();
    const created: Array<{ draftId: string; campaignId: string; company: string; role: string }> =
      [];
    const grok = createGrokClient();

    for (const hit of ranked) {
      const existing = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(and(eq(campaigns.userId, user.id), eq(campaigns.jobCanonicalId, hit.job.id)))
        .limit(1);
      if (existing[0]) continue;

      const job = {
        company: hit.job.companyName,
        role: hit.job.title,
        sourceUrl: hit.job.sourceUrl,
      };
      const composed = composeLetter(cv, job);
      const body = await finalizeLetter(
        composed,
        job,
        grok ? () => polishLetter(grok, composed.body, composed.source, job) : undefined,
      );

      const [campaign] = await db
        .insert(campaigns)
        .values({
          workspaceId: user.workspaceId,
          userId: user.id,
          state: 'pending_approval',
          jobCanonicalId: hit.job.id,
          recipientEmail: hit.job.invitedEmail,
          policyVersions: {
            match: 'desk-match-3',
            readiness: String(latestScore.total),
          },
        })
        .returning();
      if (!campaign) continue;

      const evidence: DraftEvidence = {
        company: hit.job.companyName,
        role: hit.job.title,
        person: '',
        evidenceFacts: composed.evidenceFacts.filter((fact) =>
          body.toLowerCase().includes(fact.toLowerCase()),
        ),
        priorCompanies: composed.priorCompanies,
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
