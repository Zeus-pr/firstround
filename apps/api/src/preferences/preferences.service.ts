import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { preferences, profiles, type Db } from '@firstround/db';
import {
  EMPTY_PREFERENCES_CRITERIA,
  PreferencesCriteria,
  type OnboardingStep,
  type PreferencesPayload,
  type PreferencesResponse,
  type SessionUser,
  type UpdatePreferencesRequest,
} from '@firstround/contracts';
import { DB } from '../db/db.module.js';

const EMPTY: PreferencesPayload = {
  jobFamilies: [],
  locations: [],
  targetLevel: null,
  links: {},
  criteria: EMPTY_PREFERENCES_CRITERIA,
};

function cleanLinks(links: UpdatePreferencesRequest['links']): Record<string, string> {
  const out: Record<string, string> = {};
  if (links.linkedin) out.linkedin = links.linkedin;
  if (links.github) out.github = links.github;
  if (links.portfolio) out.portfolio = links.portfolio;
  return out;
}

function normalizeCriteria(raw: unknown): PreferencesCriteria {
  const parsed = PreferencesCriteria.safeParse({
    ...EMPTY_PREFERENCES_CRITERIA,
    ...(raw && typeof raw === 'object' ? raw : {}),
  });
  return parsed.success ? parsed.data : EMPTY_PREFERENCES_CRITERIA;
}

function toPayload(row: {
  jobFamilies: string[] | null;
  locations: string[] | null;
  targetLevel: string | null;
  links: Record<string, string> | null;
  criteria?: Record<string, unknown> | null;
}): PreferencesPayload {
  return {
    jobFamilies: row.jobFamilies ?? [],
    locations: row.locations ?? [],
    targetLevel: row.targetLevel ?? null,
    links: (row.links ?? {}) as PreferencesPayload['links'],
    criteria: normalizeCriteria(row.criteria),
  };
}

@Injectable()
export class PreferencesService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  async get(user: SessionUser): Promise<PreferencesResponse> {
    const db = this.ready();
    const [row] = await db
      .select()
      .from(preferences)
      .where(eq(preferences.userId, user.id))
      .limit(1);
    const [profile] = await db
      .select({ onboardingStep: profiles.onboardingStep })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    return {
      ok: true,
      preferences: row ? toPayload(row) : EMPTY,
      onboardingStep: (profile?.onboardingStep ?? user.onboardingStep) as OnboardingStep,
    };
  }

  async upsert(user: SessionUser, body: UpdatePreferencesRequest): Promise<PreferencesResponse> {
    const db = this.ready();
    const links = cleanLinks(body.links ?? {});
    const targetLevel = body.targetLevel === '' ? null : (body.targetLevel ?? null);
    const criteria = normalizeCriteria(body.criteria);

    await db
      .insert(preferences)
      .values({
        userId: user.id,
        jobFamilies: body.jobFamilies,
        locations: body.locations,
        targetLevel,
        links,
        criteria,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: preferences.userId,
        set: {
          jobFamilies: body.jobFamilies,
          locations: body.locations,
          targetLevel,
          links,
          criteria,
          updatedAt: new Date(),
        },
      });

    const nextStep = this.nextStep(user.onboardingStep);
    if (nextStep !== user.onboardingStep) {
      await db
        .update(profiles)
        .set({ onboardingStep: nextStep, updatedAt: new Date() })
        .where(and(eq(profiles.userId, user.id)));
    }

    return {
      ok: true,
      preferences: {
        jobFamilies: body.jobFamilies,
        locations: body.locations,
        targetLevel,
        links: {
          linkedin: links.linkedin,
          github: links.github,
          portfolio: links.portfolio,
        },
        criteria,
      },
      onboardingStep: nextStep,
    };
  }

  /** After readiness, saving preferences moves the desk to Gmail. */
  private nextStep(current: OnboardingStep): OnboardingStep {
    if (
      current === 'account' ||
      current === 'cv' ||
      current === 'readiness' ||
      current === 'preferences'
    ) {
      return 'gmail';
    }
    return current;
  }
}
