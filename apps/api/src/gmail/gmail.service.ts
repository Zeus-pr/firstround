import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  encryptedTokens,
  profiles,
  type Db,
} from '@firstround/db';
import type { GmailConnectResponse, GmailStatusResponse, SessionUser } from '@firstround/contracts';
import { OnboardingStep } from '@firstround/contracts';
import { KEY_PROVIDER } from '../crypto/crypto.module.js';
import type { KeyProvider } from '../crypto/envelope.js';
import { DB } from '../db/db.module.js';
import { webOrigins } from '../env.js';
import {
  buildGoogleAuthorizeUrl,
  createPkcePair,
  exchangeGoogleCode,
  fetchGmailAddress,
  gmailOAuthConfigured,
  gmailRedirectUri,
  openGmailToken,
  openOAuthState,
  sealGmailToken,
  sealOAuthState,
} from './gmail-oauth.js';

const PROVIDER = 'google';
const PURPOSE = 'gmail';

@Injectable()
export class GmailService {
  constructor(
    @Inject(DB) private readonly db: Db | null,
    @Inject(KEY_PROVIDER) private readonly keys: KeyProvider,
  ) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  private requireOAuthEnv() {
    if (!gmailOAuthConfigured()) {
      throw new ServiceUnavailableException(
        'Gmail connect is not configured yet (missing Google OAuth env)',
      );
    }
    return {
      clientId: process.env.GOOGLE_GMAIL_CLIENT_ID!.trim(),
      clientSecret: process.env.GOOGLE_GMAIL_CLIENT_SECRET!.trim(),
      redirectUri: gmailRedirectUri(),
    };
  }

  async status(user: SessionUser): Promise<GmailStatusResponse> {
    const db = this.ready();
    const [row] = await db
      .select()
      .from(encryptedTokens)
      .where(
        and(
          eq(encryptedTokens.userId, user.id),
          eq(encryptedTokens.provider, PROVIDER),
          eq(encryptedTokens.purpose, PURPOSE),
        ),
      )
      .limit(1);

    if (!row) {
      return {
        ok: true,
        connected: false,
        email: null,
        scopes: [],
        onboardingStep: user.onboardingStep,
      };
    }

    let email: string | null = null;
    try {
      const token = await openGmailToken(
        { ciphertext: row.ciphertext, nonce: row.nonce, keyVersion: row.keyVersion },
        this.keys,
      );
      email = token.email;
    } catch {
      email = null;
    }

    return {
      ok: true,
      connected: true,
      email,
      scopes: row.scopes ?? [],
      onboardingStep: user.onboardingStep,
    };
  }

  async startConnect(user: SessionUser): Promise<GmailConnectResponse> {
    const oauth = this.requireOAuthEnv();
    const { verifier, challenge } = createPkcePair();
    const state = await sealOAuthState(user.id, verifier, this.keys);
    const authorizeUrl = buildGoogleAuthorizeUrl({
      clientId: oauth.clientId,
      redirectUri: oauth.redirectUri,
      state,
      challenge,
    });
    return { ok: true, authorizeUrl };
  }

  async handleCallback(code: string | undefined, state: string | undefined): Promise<string> {
    const desk = webOrigins()[0] ?? 'https://firstround.space';
    const fail = (reason: string) =>
      `${desk}/desk?gmail=error&reason=${encodeURIComponent(reason)}`;
    if (!code || !state) return fail('missing_code');

    let userId: string;
    let codeVerifier: string;
    try {
      ({ userId, codeVerifier } = await openOAuthState(state, this.keys));
    } catch {
      return fail('invalid_state');
    }

    const oauth = this.requireOAuthEnv();
    let exchanged: Awaited<ReturnType<typeof exchangeGoogleCode>>;
    let email: string;
    try {
      exchanged = await exchangeGoogleCode({
        code,
        codeVerifier,
        clientId: oauth.clientId,
        clientSecret: oauth.clientSecret,
        redirectUri: oauth.redirectUri,
      });
      email = await fetchGmailAddress(exchanged.accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'token_exchange_failed';
      return fail(message.slice(0, 120));
    }

    const sealed = await sealGmailToken(
      {
        refreshToken: exchanged.refreshToken,
        email,
        scope: exchanged.scope,
      },
      this.keys,
    );

    const db = this.ready();
    const scopes = exchanged.scope.split(/\s+/).filter(Boolean);
    const existing = await db
      .select({ id: encryptedTokens.id })
      .from(encryptedTokens)
      .where(
        and(
          eq(encryptedTokens.userId, userId),
          eq(encryptedTokens.provider, PROVIDER),
          eq(encryptedTokens.purpose, PURPOSE),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(encryptedTokens)
        .set({
          ciphertext: sealed.ciphertext,
          nonce: sealed.nonce,
          keyVersion: sealed.keyVersion,
          scopes,
          expiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(encryptedTokens.id, existing[0].id));
    } else {
      await db.insert(encryptedTokens).values({
        userId,
        provider: PROVIDER,
        purpose: PURPOSE,
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
        keyVersion: sealed.keyVersion,
        scopes,
        expiresAt: null,
      });
    }

    const [profile] = await db
      .select({ onboardingStep: profiles.onboardingStep })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (profile && (profile.onboardingStep === 'gmail' || profile.onboardingStep === 'preferences')) {
      await db
        .update(profiles)
        .set({ onboardingStep: 'done', updatedAt: new Date() })
        .where(eq(profiles.userId, userId));
    }

    return `${desk}/desk?gmail=connected`;
  }

  async disconnect(user: SessionUser) {
    const db = this.ready();
    await db
      .delete(encryptedTokens)
      .where(
        and(
          eq(encryptedTokens.userId, user.id),
          eq(encryptedTokens.provider, PROVIDER),
          eq(encryptedTokens.purpose, PURPOSE),
        ),
      );

    return {
      ok: true as const,
      connected: false as const,
      email: null,
      scopes: [] as string[],
      onboardingStep: OnboardingStep.parse(user.onboardingStep),
    };
  }
}
