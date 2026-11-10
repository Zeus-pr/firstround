import type { User } from 'firebase/auth';
import { apiUrl } from './api-url';

export type PreferencesCriteria = {
  expectedCtcMinLakh?: number | null;
  expectedCtcMaxLakh?: number | null;
  desiredCompanies: string[];
  avoidCompanies: string[];
  industries: string[];
  skills: string[];
  workModes: Array<'remote' | 'hybrid' | 'onsite'>;
  employmentTypes: string[];
  keywords: string[];
  noticePeriodDays?: number | null;
  openToRelocation?: boolean | null;
  minYearsExperience?: number | null;
  maxYearsExperience?: number | null;
  letterShuffle?: boolean;
};

export type PreferencesPayload = {
  jobFamilies: string[];
  locations: string[];
  targetLevel?: string | null;
  links: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  criteria: PreferencesCriteria;
};

export type PreferencesResponse = {
  ok: true;
  preferences: PreferencesPayload;
  onboardingStep: string;
};

export const EMPTY_CRITERIA: PreferencesCriteria = {
  expectedCtcMinLakh: null,
  expectedCtcMaxLakh: null,
  desiredCompanies: [],
  avoidCompanies: [],
  industries: [],
  skills: [],
  workModes: [],
  employmentTypes: [],
  keywords: [],
  noticePeriodDays: null,
  openToRelocation: null,
  minYearsExperience: null,
  maxYearsExperience: null,
  letterShuffle: true,
};

async function authHeaders(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function fetchPreferences(user: User): Promise<PreferencesResponse> {
  const res = await fetch(apiUrl('/preferences'), { headers: await authHeaders(user) });
  if (!res.ok) throw new Error(`Could not load preferences (${res.status})`);
  const json = (await res.json()) as PreferencesResponse;
  return {
    ...json,
    preferences: {
      ...json.preferences,
      criteria: { ...EMPTY_CRITERIA, ...(json.preferences.criteria ?? {}) },
    },
  };
}

export async function savePreferences(
  user: User,
  body: PreferencesPayload,
): Promise<PreferencesResponse> {
  const res = await fetch(apiUrl('/preferences'), {
    method: 'PUT',
    headers: await authHeaders(user),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Could not save preferences (${res.status})`);
  }
  return (await res.json()) as PreferencesResponse;
}

export function splitList(value: string, max = 20): string[] {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function parseOptionalNumber(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
