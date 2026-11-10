import { createHash, randomBytes } from 'node:crypto';
import { GMAIL_SCOPES } from '@firstround/contracts';
import type { EncryptedBlob, KeyProvider } from '../crypto/envelope.js';
import { open, seal } from '../crypto/envelope.js';

export type GmailTokenPayload = {
  refreshToken: string;
  email: string;
  scope: string;
};

type OAuthStatePayload = {
  u: string;
  v: string;
  e: number;
};

export function gmailOAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.GOOGLE_GMAIL_CLIENT_ID?.trim() &&
    env.GOOGLE_GMAIL_CLIENT_SECRET?.trim() &&
    (env.GOOGLE_GMAIL_REDIRECT_URI?.trim() || env.PUBLIC_API_ORIGIN?.trim()),
  );
}

export function gmailRedirectUri(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.GOOGLE_GMAIL_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const origin = env.PUBLIC_API_ORIGIN?.trim()?.replace(/\/$/, '');
  if (!origin) {
    throw new Error('GOOGLE_GMAIL_REDIRECT_URI or PUBLIC_API_ORIGIN is required');
  }
  return `${origin}/gmail/callback`;
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export async function sealOAuthState(
  userId: string,
  codeVerifier: string,
  provider: KeyProvider,
): Promise<string> {
  const sealed = await seal(
    JSON.stringify({
      u: userId,
      v: codeVerifier,
      e: Date.now() + 10 * 60_000,
    } satisfies OAuthStatePayload),
    provider,
  );
  return Buffer.from(JSON.stringify(sealed)).toString('base64url');
}

export async function openOAuthState(
  state: string,
  provider: KeyProvider,
): Promise<{ userId: string; codeVerifier: string }> {
  let sealed: EncryptedBlob;
  try {
    sealed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as EncryptedBlob;
  } catch {
    throw new Error('Invalid OAuth state');
  }
  const raw = await open(sealed, provider);
  const payload = JSON.parse(raw) as OAuthStatePayload;
  if (!payload?.u || !payload?.v || !payload?.e) throw new Error('Invalid OAuth state payload');
  if (Date.now() > payload.e) throw new Error('OAuth state expired');
  return { userId: payload.u, codeVerifier: payload.v };
}

export function buildGoogleAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GMAIL_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'false');
  url.searchParams.set('state', opts.state);
  url.searchParams.set('code_challenge', opts.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function scopesIncludeRequired(scope: string): boolean {
  const granted = new Set(scope.split(/\s+/).filter(Boolean));
  return GMAIL_SCOPES.every((needed) => granted.has(needed));
}

export async function exchangeGoogleCode(opts: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresIn: number;
}> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'Google token exchange failed');
  }
  if (!json.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Disconnect the app in Google Account and try again.',
    );
  }
  if (!json.scope || !scopesIncludeRequired(json.scope)) {
    throw new Error('Gmail send and readonly scopes are both required.');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    scope: json.scope,
    expiresIn: json.expires_in ?? 3600,
  };
}

export async function fetchGmailAddress(accessToken: string): Promise<string> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { emailAddress?: string; error?: { message?: string } };
  if (!res.ok || !json.emailAddress) {
    throw new Error(json.error?.message || 'Could not read the Gmail address');
  }
  return json.emailAddress;
}

export async function sealGmailToken(
  payload: GmailTokenPayload,
  provider: KeyProvider,
): Promise<EncryptedBlob> {
  return seal(JSON.stringify(payload), provider);
}

export async function openGmailToken(
  blob: EncryptedBlob,
  provider: KeyProvider,
): Promise<GmailTokenPayload> {
  const raw = await open(blob, provider);
  const parsed = JSON.parse(raw) as GmailTokenPayload;
  if (!parsed?.refreshToken || !parsed?.email) throw new Error('Corrupt Gmail token payload');
  return parsed;
}
