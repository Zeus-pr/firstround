import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirebaseAuthGuard } from '../src/auth/firebase-auth.guard.js';
import { FirebaseAuthService } from '../src/auth/firebase-auth.service.js';
import { createIpRateLimiter } from '../src/auth/rate-limit.js';

describe('FirebaseAuthService.init', () => {
  const keys = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ] as const;
  const saved: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  afterEach(() => {
    for (const key of keys) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function clear() {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  }

  it('stays unconfigured without credentials', () => {
    clear();
    const svc = new FirebaseAuthService();
    expect(svc.init({})).toBeNull();
  });
});

describe('FirebaseAuthGuard', () => {
  it('rejects missing Bearer token', async () => {
    const auth = {
      verifyIdToken: vi.fn(),
    } as unknown as FirebaseAuthService;
    const guard = new FirebaseAuthGuard(auth);
    const req = { headers: {} };
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
  });

  it('attaches user from a valid token', async () => {
    const auth = {
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'uid-1',
        email: 'a@example.com',
        emailVerified: true,
      }),
    } as unknown as FirebaseAuthService;
    const guard = new FirebaseAuthGuard(auth);
    const req: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: 'Bearer good.token' },
    };
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never),
    ).resolves.toBe(true);
    expect(req.user).toEqual({
      uid: 'uid-1',
      email: 'a@example.com',
      emailVerified: true,
    });
  });
});

describe('createIpRateLimiter', () => {
  it('blocks after the limit inside the window', () => {
    const allow = createIpRateLimiter(2, 60_000);
    expect(allow('a')).toBe(true);
    expect(allow('a')).toBe(true);
    expect(allow('a')).toBe(false);
    expect(allow('b')).toBe(true);
  });
});
