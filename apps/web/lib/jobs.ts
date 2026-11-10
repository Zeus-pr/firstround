import type { User } from 'firebase/auth';
import { apiUrl } from './api-url';

async function authHeaders(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export type CorpusStatus = {
  ok: true;
  counts: { canonical: number; quarantined: number; stale: number };
  sources: Array<{
    sourceKey: string;
    enabled: boolean;
    killSwitch: boolean;
    legalStatus: string;
  }>;
  apifyConfigured: boolean;
};

export type ReviewDraft = {
  id: string;
  campaignId: string;
  body: string;
  status: string;
  specificity: number;
  draftHash: string | null;
  company?: string;
  role?: string;
  subject?: string;
  createdAt?: string;
};

export async function fetchCorpusStatus(user: User): Promise<CorpusStatus> {
  const res = await fetch(apiUrl('/jobs/corpus/status'), { headers: await authHeaders(user) });
  if (!res.ok) throw new Error(`Could not load today’s openings (${res.status})`);
  return (await res.json()) as CorpusStatus;
}

export async function fetchTodayDrafts(user: User): Promise<ReviewDraft[]> {
  const res = await fetch(apiUrl('/review/today'), { headers: await authHeaders(user) });
  if (!res.ok) throw new Error(`Could not load today's drafts (${res.status})`);
  const json = (await res.json()) as { drafts: ReviewDraft[] };
  return json.drafts ?? [];
}

export async function saveDraftBody(
  user: User,
  draftId: string,
  body: string,
  subject?: string,
): Promise<void> {
  const res = await fetch(apiUrl(`/review/drafts/${draftId}`), {
    method: 'PUT',
    headers: await authHeaders(user),
    body: JSON.stringify({ body, subject }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Could not save draft (${res.status})`);
  }
}

export async function cancelDraft(user: User, draftId: string): Promise<void> {
  const res = await fetch(apiUrl(`/review/drafts/${draftId}/cancel`), {
    method: 'POST',
    headers: await authHeaders(user),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Could not cancel the letter (${res.status})`);
  }
}

export async function approveDraft(user: User, draftId: string, body?: string): Promise<void> {
  const res = await fetch(apiUrl(`/review/drafts/${draftId}/approve`), {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify(body ? { body } : {}),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Could not approve draft (${res.status})`);
  }
}

export type DeskRunResult = {
  ok: true;
  status?: 'selecting' | 'ready' | 'empty' | 'failed';
  runId?: string;
  created: number;
  considered: number;
  drafts: Array<{ draftId: string; campaignId: string; company: string; role: string }>;
  message: string;
  readinessTotal: number;
};

export async function fetchDeskRun(
  user: User,
  runId: string,
): Promise<{ status: string; message: string; created: number }> {
  const res = await fetch(apiUrl(`/desk/run/${runId}`), { headers: await authHeaders(user) });
  if (!res.ok) throw new Error(`Could not check the round (${res.status})`);
  return (await res.json()) as { status: string; message: string; created: number };
}

export async function startDeskRun(user: User): Promise<DeskRunResult> {
  const res = await fetch(apiUrl('/desk/run'), {
    method: 'POST',
    headers: await authHeaders(user),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      typeof err?.message === 'string' ? err.message : `Could not start your round (${res.status})`,
    );
  }
  return (await res.json()) as DeskRunResult;
}
