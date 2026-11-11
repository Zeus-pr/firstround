import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, gte, ne, or, sql } from 'drizzle-orm';
import {
  campaignDrafts,
  campaigns,
  canonicalJobs,
  cvExtractions,
  cvReadinessScores,
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
import { companyKey, pickHrContact, type HrContact } from './hr-contacts.js';
import { writeRoleInterest } from './interest.js';
import { renderLetter } from './letter-templates.js';
import { fingerprintJob, parseInvitedEmail } from './normalize.js';
import {
  assertPublicJobUrl,
  emailIn,
  htmlToText,
  openingFromHtml,
  openingFromModel,
  type ParsedOpening,
} from './opening-parse.js';

const MODEL_PROMPT =
  'Read this job posting. Return JSON only: {"isJob":boolean,"company":string,"title":string,"location":string,"description":string,"email":string,"url":string}. isJob is false when this is not one job opening. Use only words that are present. email is a work address printed on the posting, or empty.';

type CvFactsLike = {
  fullName?: string | null;
  phones?: string[];
  links?: { linkedin?: string | null };
  roles?: Array<{ isCurrent?: boolean; bullets?: string[] }>;
};

function modelName(): string {
  return process.env.XAI_MODEL?.trim() || 'grok-4.7';
}

function titleCase(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function firstName(email: string | null, fullName: string | null): string | null {
  const fromName = fullName?.trim().split(/\s+/)[0] ?? '';
  if (fromName) return titleCase(fromName);
  const local = email?.split('@')[0]?.split(/[._+-]/)[0] ?? '';
  if (!/^[a-z]{3,20}$/i.test(local)) return null;
  return titleCase(local);
}

@Injectable()
export class OpeningService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  async add(user: SessionUser, input: { url?: string; imageBase64?: string; imageType?: string }) {
    const db = this.ready();
    const opening = input.imageBase64
      ? await this.readImage(input.imageBase64, input.imageType ?? 'image/jpeg')
      : await this.readUrl(input.url ?? '');
    if (!opening) {
      throw new BadRequestException('Could not find a job opening in that.');
    }

    const [latestScore] = await db
      .select({
        total: cvReadinessScores.total,
        extractionId: cvReadinessScores.extractionId,
      })
      .from(cvReadinessScores)
      .where(eq(cvReadinessScores.userId, user.id))
      .orderBy(desc(cvReadinessScores.createdAt))
      .limit(1);
    if (!latestScore) {
      throw new BadRequestException('Upload a CV before adding a role.');
    }

    const fingerprint = fingerprintJob({
      companyDomain: null,
      companyName: opening.company,
      normalizedTitle: null,
      title: opening.title,
      location: opening.location,
      descriptionText: opening.description,
    });
    const printed = parseInvitedEmail(opening.description)?.email ?? opening.email;
    const [job] = await db
      .insert(canonicalJobs)
      .values({
        fingerprint,
        title: opening.title,
        companyName: opening.company,
        location: opening.location,
        descriptionText: opening.description,
        sourceUrl: opening.url,
        applicationUrl: opening.url,
        posterType: 'direct',
        trustScore: 70,
        quarantined: true,
        stale: false,
        invitedEmail: printed,
        skills: [],
      })
      .onConflictDoUpdate({
        target: canonicalJobs.fingerprint,
        set: {
          title: opening.title,
          companyName: opening.company,
          location: opening.location,
          descriptionText: opening.description,
          sourceUrl: opening.url,
          applicationUrl: opening.url,
          invitedEmail: printed,
          stale: false,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!job) throw new ServiceUnavailableException('Could not save that role');

    const [existing] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.userId, user.id), eq(campaigns.jobCanonicalId, job.id)))
      .limit(1);
    if (existing) {
      return {
        ok: true as const,
        created: 0,
        message: 'That role is already in your drafts.',
      };
    }

    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const madeToday = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.userId, user.id),
          gte(campaigns.createdAt, new Date(`${day}T00:00:00+05:30`)),
          ne(campaigns.state, 'cancelled_by_user'),
        ),
      );
    if (madeToday.length >= 40) {
      throw new BadRequestException(
        'Today’s 40 are already here. Cancel a letter if you want a different role.',
      );
    }

    const recipient = await this.recipientFor(opening.company, printed);
    const [prefsRow] = await db
      .select()
      .from(preferences)
      .where(eq(preferences.userId, user.id))
      .limit(1);
    const criteria = PreferencesCriteria.safeParse({
      ...EMPTY_PREFERENCES_CRITERIA,
      ...(prefsRow?.criteria ?? {}),
    });
    const prefs: PreferencesPayload = {
      jobFamilies: prefsRow?.jobFamilies ?? [],
      locations: prefsRow?.locations ?? [],
      targetLevel: prefsRow?.targetLevel ?? null,
      links: (prefsRow?.links ?? {}) as PreferencesPayload['links'],
      criteria: criteria.success ? criteria.data : EMPTY_PREFERENCES_CRITERIA,
    };
    const [extraction] = await db
      .select({ facts: cvExtractions.facts })
      .from(cvExtractions)
      .where(and(eq(cvExtractions.id, latestScore.extractionId), eq(cvExtractions.userId, user.id)))
      .limit(1);
    const facts = (extraction?.facts ?? null) as CvFactsLike | null;
    const roles = facts?.roles ?? [];
    const current = roles.find((role) => role.isCurrent) ?? roles[0];
    const bullets = (current?.bullets ?? [])
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .slice(0, 2);
    const grok = createGrokClient();
    const interest = grok
      ? await writeRoleInterest(grok, {
          company: opening.company,
          role: opening.title,
          description: opening.description,
          bullets,
        })
      : null;
    const letter = renderLetter({
      company: opening.company,
      role: opening.title,
      sourceUrl: opening.url,
      candidateName: facts?.fullName?.trim() || null,
      recruiterName: recipient.name,
      phone: facts?.phones?.find((phone) => phone.trim())?.trim() ?? null,
      linkedin:
        facts?.links?.linkedin?.trim() ||
        (typeof prefs.links?.linkedin === 'string' ? prefs.links.linkedin.trim() : '') ||
        null,
      bullets,
      interest,
      shuffle: prefs.criteria.letterShuffle !== false,
      seed: job.id,
    });
    const [campaign] = await db
      .insert(campaigns)
      .values({
        workspaceId: user.workspaceId,
        userId: user.id,
        state: 'pending_approval',
        jobCanonicalId: job.id,
        recipientEmail: recipient.email,
        policyVersions: { match: 'added-opening', readiness: String(latestScore.total) },
      })
      .returning();
    if (!campaign) throw new ServiceUnavailableException('Could not save that letter');
    const evidence = {
      company: opening.company,
      role: opening.title,
      person: '',
      subject: letter.subject,
      templateId: letter.templateId,
      evidenceFacts: [opening.company, opening.title, ...bullets].filter(Boolean),
    };
    await db.insert(campaignDrafts).values({
      campaignId: campaign.id,
      userId: user.id,
      body: letter.body,
      specificity: scoreSpecificity(letter.body, evidence),
      evidence,
      status: 'pending_approval',
      expiresAt: new Date(Date.now() + 12 * 60 * 60_000),
    });
    return {
      ok: true as const,
      created: 1,
      message: recipient.email
        ? `Added a letter for ${opening.company}.`
        : `Added a letter for ${opening.company}. No address yet.`,
    };
  }

  private async recipientFor(companyName: string, invitedEmail: string | null) {
    if (invitedEmail) return { email: invitedEmail, name: firstName(invitedEmail, null) };
    const key = companyKey(companyName);
    if (!key) return { email: null, name: null };
    const folded = key.replace(/ /g, '');
    const rows = await this.ready()
      .select({
        fullName: hrContacts.fullName,
        title: hrContacts.title,
        companyName: hrContacts.companyName,
        email: hrContacts.email,
      })
      .from(hrContacts)
      .where(
        or(
          eq(hrContacts.companyKey, key),
          sql`replace(${hrContacts.companyKey}, ' ', '') = ${folded}`,
          sql`${hrContacts.companyKey} like ${`${key} %`}`,
          sql`${key} like (${hrContacts.companyKey} || ' %')`,
        ),
      );
    const picked = pickHrContact(companyName, rows as HrContact[]);
    return {
      email: picked?.email ?? null,
      name: picked ? firstName(null, picked.fullName) : null,
    };
  }

  private async readUrl(raw: string): Promise<ParsedOpening | null> {
    const page = await this.fetchPublic(raw);
    const fromPage = openingFromHtml(page.html, page.url);
    if (fromPage?.company && fromPage.title) return fromPage;
    const text = htmlToText(page.html).slice(0, 12_000);
    const read = await this.askModel([{ type: 'text', text: `${MODEL_PROMPT}\n\n${text}` }]);
    const opening = openingFromModel(read, page.url);
    if (!opening) return null;
    opening.email = opening.email ?? emailIn(text);
    return opening;
  }

  private async readImage(imageBase64: string, imageType: string): Promise<ParsedOpening | null> {
    if (!/^[a-z0-9+/=\s]+$/i.test(imageBase64)) {
      throw new BadRequestException('That screenshot could not be read.');
    }
    const read = await this.askModel([
      { type: 'text', text: MODEL_PROMPT },
      { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}` } },
    ]);
    return openingFromModel(read, null);
  }

  private async askModel(
    content: Array<
      { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
    >,
  ): Promise<string> {
    const client = createGrokClient();
    if (!client) throw new ServiceUnavailableException('Could not read that posting right now.');
    const response = await client.chat.completions.create({
      model: modelName(),
      temperature: 0,
      messages: [{ role: 'user', content }],
    });
    return response.choices[0]?.message?.content ?? '';
  }

  private async fetchPublic(raw: string): Promise<{ url: string; html: string }> {
    let current = raw;
    for (let hop = 0; hop < 3; hop += 1) {
      let target: URL;
      try {
        target = assertPublicJobUrl(current);
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        throw new BadRequestException(
          code === 'blocked-url' ? 'That link cannot be opened.' : 'That link is not a job page.',
        );
      }
      const response = await fetch(target, {
        redirect: 'manual',
        signal: AbortSignal.timeout(12_000),
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'FirstRoundBot/1.0' },
      });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get('location');
        if (!next) throw new BadRequestException('That link did not open.');
        current = new URL(next, target).toString();
        continue;
      }
      if (!response.ok) throw new BadRequestException('That link did not open.');
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > 1_500_000) throw new BadRequestException('That page is too large to read.');
      const html = (await response.text()).slice(0, 1_500_000);
      return { url: target.toString(), html };
    }
    throw new BadRequestException('That link did not open.');
  }
}
