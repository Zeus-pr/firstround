import { afterEach, describe, expect, it } from 'vitest';
import { StorageService } from '../src/files/storage.service.js';

const KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_ENDPOINT',
] as const;

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function clearR2Env() {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreR2Env() {
  for (const key of KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  restoreR2Env();
});

describe('StorageService', () => {
  it('reports unconfigured when R2 env is missing', async () => {
    clearR2Env();
    const storage = new StorageService();
    expect(storage.isConfigured()).toBe(false);
    await expect(storage.status()).resolves.toEqual({
      ok: false,
      configured: false,
      bucket: null,
    });
  });

  it('builds a configured client when env is present', () => {
    clearR2Env();
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'firstround-cv';
    const storage = new StorageService();
    expect(storage.isConfigured()).toBe(true);
    expect(storage.bucketName()).toBe('firstround-cv');
  });
});
