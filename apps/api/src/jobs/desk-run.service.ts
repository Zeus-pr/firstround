import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, gte, ilike, ne, not, or } from 'drizzle-orm';
import {
  campaignDrafts,
  campaigns,
  canonicalJobs,
  cvExtractions,
  cvReadinessScores,
  deskRuns,
  hrContacts,
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
import { createGrokClient } from '../cv/grok-extract.js';
import { scoreSpecificity } from './draft.js';
import { judgeJobFit } from './fit-review.js';
import { renderLetter } from './letter-templates.js';
import {
  candidateProfession,
  professionPool,
  sameProfession,
  type ProfessionCv,
} from './profession.js';
import { companyKey, pickHrContact, type HrContact } from './hr-contacts.js';
import { rankMatches, type MatchableJob } from './match.js';

const EMPTY_PREFS: PreferencesPayload = {
  jobFamilies: [],
  locations: [],
  targetLevel: null,
  links: {},
  criteria: EMPTY_PREFERENCES_CRITERIA,
};

const DAILY_LETTER_CAP = 10;

function eveningCutoff(now = new Date()): Date {
  return new Date(now.getTime() + 12 * 60 * 60_000);
}

/** Midnight in India. The daily letter cap follows that day, not UTC. */
function startOfIndiaDay(now = new Date()): Date {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${day}T00:00:00+05:30`);
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

type CvFactsLike = {
  fullName?: string | null;
  phones?: string[];
  links?: { linkedin?: string | null };
  roles?: Array<{ isCurrent?: boolean; title?: string; bullets?: string[] }>;
  targetRoleHints?: string[];
  skills?: string[];
};

const GENERIC_INBOX = new Set([
  'hr',
  'jobs',
  'job',
  'careers',
  'career',
  'info',
  'hello',
  'talent',
  'hiring',
  'recruit',
  'recruiter',
  'admin',
  'team',
  'apply',
]);

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function recruiterFirst(email: string | null): string | null {
  const local = email?.split('@')[0]?.split(/[._+-]/)[0] ?? '';
  if (!/^[a-z]{3,20}$/i.test(local) || GENERIC_INBOX.has(local.toLowerCase())) return null;
  return titleCase(local);
}

function proofBullets(facts: CvFactsLike | null): string[] {
  const roles = facts?.roles ?? [];
  const current = roles.find((role) => role.isCurrent) ?? roles[0];
  return (current?.bullets ?? [])
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 2);
}

@Injectable()
export class DeskRunService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  /** Printed job address wins. Otherwise one HR contact from the company pool. */
  private async recipientFor(companyName: string, invitedEmail: string | null) {
    if (invitedEmail) return { email: invitedEmail, name: recruiterFirst(invitedEmail) };
    const key = companyKey(companyName);
    if (!key) return { email: null, name: null };
    const db = this.ready();
    const rows = await db
      .select({
        fullName: hrContacts.fullName,
        title: hrContacts.title,
        companyName: hrContacts.companyName,
        email: hrContacts.email,
      })
      .from(hrContacts)
      .where(eq(hrContacts.companyKey, key));
    const picked = pickHrContact(companyName, rows as HrContact[]);
    const first = picked?.fullName.trim().split(/\s+/)[0] ?? '';
    return {
      email: picked?.email ?? null,
      name: first ? titleCase(first) : null,
    };
  }

  async runToday(user: SessionUser) {
    const db = this.ready();
    const [latestScore] = await db
      .select({ total: cvReadinessScores.total })
      .from(cvReadinessScores)
      .where(eq(cvReadinessScores.userId, user.id))
      .orderBy(desc(cvReadinessScores.createdAt))
      .limit(1);
    if (!latestScore) {
      throw new BadRequestException('Upload a CV and get a score before starting your round.');
    }
    const [run] = await db
      .insert(deskRuns)
      .values({
        userId: user.id,
        status: 'selecting',
        message: 'We are choosing the right roles. Check back in a few minutes.',
      })
      .returning();
    if (!run) throw new ServiceUnavailableException('Could not start the round');
    void this.prepareRound(user, run.id)
      .then(async (result) => {
        await db
          .update(deskRuns)
          .set({
            status: result.created > 0 ? 'ready' : 'empty',
            message: result.message,
            createdCount: result.created,
            finishedAt: new Date(),
          })
          .where(eq(deskRuns.id, run.id));
      })
      .catch(async () => {
        await db
          .update(deskRuns)
          .set({
            status: 'failed',
            message: 'Something got stuck. Try once more.',
            finishedAt: new Date(),
          })
          .where(eq(deskRuns.id, run.id));
      });
    return {
      ok: true as const,
      status: 'selecting' as const,
      runId: run.id,
      created: 0,
      considered: 0,
      drafts: [] as Array<{ draftId: string; campaignId: string; company: string; role: string }>,
      message: 'We are choosing the right roles. Check back in a few minutes.',
      readinessTotal: latestScore.total,
    };
  }

  async getRun(user: SessionUser, runId: string) {
    const db = this.ready();
    const [run] = await db
      .select()
      .from(deskRuns)
      .where(and(eq(deskRuns.id, runId), eq(deskRuns.userId, user.id)))
      .limit(1);
    if (!run) throw new BadRequestException('Round not found');
    return {
      ok: true as const,
      status: run.status,
      runId: run.id,
      created: run.createdCount,
      message: run.message ?? '',
    };
  }

  async prepareRound(user: SessionUser, _runId: string) {
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
    const facts = (extraction?.facts ?? null) as CvFactsLike | null;
    const bullets = proofBullets(facts);
    const candidateFirst = titleCase((facts?.fullName ?? '').trim().split(/\s+/)[0] ?? '');

    const profession = candidateProfession((extraction?.facts ?? {}) as ProfessionCv);
    const pool = professionPool(profession);
    const titleFilter = pool
      ? and(
          or(...pool.include.map((needle) => ilike(canonicalJobs.title, `%${needle}%`))),
          ...pool.exclude.map((needle) => not(ilike(canonicalJobs.title, `%${needle}%`))),
        )
      : undefined;
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
      .limit(80);

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
        message: 'No openings in your line of work yet.',
        readinessTotal: latestScore.total,
      };
    }

    const madeToday = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.userId, user.id),
          gte(campaigns.createdAt, startOfIndiaDay()),
          ne(campaigns.state, 'cancelled_by_user'),
        ),
      );
    const room = DAILY_LETTER_CAP - madeToday.length;
    if (room <= 0) {
      return {
        ok: true as const,
        created: 0,
        considered: matchable.length,
        drafts: [],
        message: 'Today’s 10 are already here. Cancel a letter if you want a different role.',
        readinessTotal: latestScore.total,
      };
    }

    const ranked = rankMatches(
      prefs,
      matchable.filter((job) => profession === 'other' || sameProfession(profession, job.title)),
      { minMatch: 48, limit: room },
    );
    const grok = createGrokClient();
    const cvLines = [
      ...(((extraction?.facts as { roles?: Array<{ title?: string }> } | undefined)?.roles ?? [])
        .map((role) => role.title)
        .filter(Boolean) as string[]),
      ...((extraction?.facts as { skills?: string[] } | undefined)?.skills ?? []).slice(0, 12),
    ];
    const accepted = [];
    let modelDown = false;
    for (const hit of ranked) {
      if (profession !== 'other' && !sameProfession(profession, hit.job.title)) continue;
      if (!grok || modelDown) {
        accepted.push(hit);
        continue;
      }
      let verdict = null;
      try {
        verdict = await judgeJobFit(grok, {
          profession,
          cvLines,
          title: hit.job.title,
          company: hit.job.companyName,
          skills: hit.job.skills,
          description: hit.job.descriptionText,
        });
      } catch {
        modelDown = true;
        accepted.push(hit);
        continue;
      }
      if (verdict?.sameProfession && verdict.fit >= 70) accepted.push(hit);
      if (accepted.length >= room) break;
    }
    const chosen = (grok ? accepted : ranked).slice(0, room);
    if (chosen.length === 0) {
      return {
        ok: true as const,
        created: 0,
        considered: matchable.length,
        drafts: [],
        message:
          madeToday.length > 0
            ? 'No new roles this time. The letters already here stay until you cancel them.'
            : 'Nothing was close enough to your work.',
        readinessTotal: latestScore.total,
      };
    }

    const expiresAt = eveningCutoff();
    const created: Array<{ draftId: string; campaignId: string; company: string; role: string }> =
      [];

    for (const hit of chosen) {
      const existing = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(and(eq(campaigns.userId, user.id), eq(campaigns.jobCanonicalId, hit.job.id)))
        .limit(1);
      if (existing[0]) continue;

      const recipient = await this.recipientFor(hit.job.companyName, hit.job.invitedEmail);
      const letter = renderLetter({
        company: hit.job.companyName,
        role: hit.job.title,
        sourceUrl: hit.job.sourceUrl,
        candidateName: candidateFirst || facts?.fullName?.trim() || null,
        recruiterName: recipient.name,
        phone: facts?.phones?.find((p) => p.trim())?.trim() ?? null,
        linkedin: facts?.links?.linkedin?.trim() || null,
        bullets,
        shuffle: prefs.criteria.letterShuffle !== false,
        seed: hit.job.id,
      });

      const [campaign] = await db
        .insert(campaigns)
        .values({
          workspaceId: user.workspaceId,
          userId: user.id,
          state: 'pending_approval',
          jobCanonicalId: hit.job.id,
          recipientEmail: recipient.email,
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
        subject: letter.subject,
        templateId: letter.templateId,
        evidenceFacts: [hit.job.companyName, hit.job.title, ...bullets].filter(Boolean),
      };
      const specificity = scoreSpecificity(letter.body, evidence);

      const [draft] = await db
        .insert(campaignDrafts)
        .values({
          campaignId: campaign.id,
          userId: user.id,
          body: letter.body,
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
          ? madeToday.length > 0
            ? `Added ${created.length} more. The earlier letters stay until you cancel them.`
            : `Found ${created.length} fit${created.length === 1 ? '' : 's'} for you to review.`
          : 'No new roles this time. The letters already here stay until you cancel them.',
      readinessTotal: latestScore.total,
    };
  }
}
