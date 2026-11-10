import type { User } from 'firebase/auth';
import { apiUrl } from './api-url';

export type GmailStatus = {
  ok: true;
  connected: boolean;
  email: string | null;
  scopes: string[];
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

export async function fetchGmailStatus(user: User): Promise<GmailStatus> {
  const res = await fetch(apiUrl('/gmail/status'), { headers: await authHeaders(user) });
  if (!res.ok) throw new Error(`Could not load Gmail status (${res.status})`);
  return (await res.json()) as GmailStatus;
}

export async function startGmailConnect(user: User): Promise<{ authorizeUrl: string }> {
  const res = await fetch(apiUrl('/gmail/connect'), {
    method: 'POST',
    headers: await authHeaders(user),
  });
  if (res.status === 503) {
    throw new Error('Gmail connect is not configured on the API yet.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Could not start Gmail connect (${res.status})`);
  }
  return (await res.json()) as { authorizeUrl: string };
}

export async function disconnectGmail(user: User): Promise<GmailStatus> {
  const res = await fetch(apiUrl('/gmail/disconnect'), {
    method: 'DELETE',
    headers: await authHeaders(user),
  });
  if (!res.ok) throw new Error(`Could not disconnect Gmail (${res.status})`);
  return (await res.json()) as GmailStatus;
}
