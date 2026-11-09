import type { User } from 'firebase/auth';
import { apiUrl } from './api-url';

export type PreferencesPayload = {
  jobFamilies: string[];
  locations: string[];
  targetLevel?: string | null;
  links: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
};

export type PreferencesResponse = {
  ok: true;
  preferences: PreferencesPayload;
  onboardingStep: string;
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
  return (await res.json()) as PreferencesResponse;
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

export function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 20);
}
