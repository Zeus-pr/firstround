import type { User } from 'firebase/auth';
import { apiUrl } from './api-url';

export type SessionPayload = {
  ok: true;
  user: {
    id: string;
    workspaceId: string;
    firebaseUid: string;
    email: string | null;
    displayName: string | null;
    onboardingStep: string;
    created: boolean;
  };
};

/** Persist the Firebase user into Nest/Postgres. Safe to call on every auth change. */
export async function ensureAppSession(user: User): Promise<SessionPayload | null> {
  const token = await user.getIdToken();
  const response = await fetch(apiUrl('/session'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Session sync failed (${response.status})`);
  }
  return (await response.json()) as SessionPayload;
}
