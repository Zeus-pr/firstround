import { describe, expect, it } from 'vitest';
import { LocalKeyProvider, open, seal } from '@/lib/crypto/envelope';

describe('envelope encryption', () => {
  it('round-trips a token with the local key provider', async () => {
    const provider = new LocalKeyProvider(
      [
        {
          version: 1,
          material: Buffer.from('12345678901234567890123456789012').toString('base64'),
        },
      ],
      1,
    );
    const sealed = await seal('refresh-token-value', provider);
    expect(sealed.keyVersion).toBe(1);
    expect(sealed.ciphertext).not.toContain('refresh-token-value');
    await expect(open(sealed, provider)).resolves.toBe('refresh-token-value');
  });
});
