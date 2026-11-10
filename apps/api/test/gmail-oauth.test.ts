import { describe, expect, it } from 'vitest';
import { LocalKeyProvider } from '../src/crypto/envelope.js';
import {
  buildGoogleAuthorizeUrl,
  createPkcePair,
  openOAuthState,
  scopesIncludeRequired,
  sealOAuthState,
} from '../src/gmail/gmail-oauth.js';

describe('gmail oauth helpers', () => {
  const provider = new LocalKeyProvider(
    [{ version: 1, material: Buffer.from('12345678901234567890123456789012').toString('base64') }],
    1,
  );

  it('builds an authorize URL with PKCE and both Gmail scopes', () => {
    const { challenge } = createPkcePair();
    const url = new URL(
      buildGoogleAuthorizeUrl({
        clientId: 'client.apps.googleusercontent.com',
        redirectUri: 'https://api.firstround.space/gmail/callback',
        state: 'abc',
        challenge,
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toContain('gmail.send');
    expect(url.searchParams.get('scope')).toContain('gmail.readonly');
  });

  it('round-trips sealed OAuth state', async () => {
    const { verifier } = createPkcePair();
    const state = await sealOAuthState('user-1', verifier, provider);
    const opened = await openOAuthState(state, provider);
    expect(opened.userId).toBe('user-1');
    expect(opened.codeVerifier).toBe(verifier);
  });

  it('requires both Gmail scopes', () => {
    expect(
      scopesIncludeRequired(
        'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
      ),
    ).toBe(true);
    expect(scopesIncludeRequired('https://www.googleapis.com/auth/gmail.send')).toBe(false);
  });
});
