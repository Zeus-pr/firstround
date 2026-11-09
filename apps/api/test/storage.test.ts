import { describe, expect, it } from 'vitest';
import { StorageService } from '../src/files/storage.service.js';

describe('StorageService', () => {
  it('reports unconfigured when R2 env is missing', async () => {
    const storage = new StorageService({});
    expect(storage.isConfigured()).toBe(false);
    await expect(storage.status()).resolves.toEqual({
      ok: false,
      configured: false,
      bucket: null,
    });
  });

  it('builds a configured client when env is present', () => {
    const storage = new StorageService({
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'firstround-cv',
    });
    expect(storage.isConfigured()).toBe(true);
    expect(storage.bucketName()).toBe('firstround-cv');
  });
});
