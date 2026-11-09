import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedBlob = {
  ciphertext: string;
  nonce: string;
  keyVersion: number;
};

export type KeyEncryptionKey = {
  version: number;
  /** 32-byte key as base64 */
  material: string;
};

export interface KeyProvider {
  current(): Promise<KeyEncryptionKey>;
  get(version: number): Promise<KeyEncryptionKey>;
}

/** Dev/CI KMS: keys from env, never for production Gmail tokens. */
export class LocalKeyProvider implements KeyProvider {
  constructor(
    private readonly keys: KeyEncryptionKey[],
    private readonly currentVersion: number,
  ) {
    if (!keys.some((k) => k.version === currentVersion)) {
      throw new Error(`Current key version ${currentVersion} is missing`);
    }
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): LocalKeyProvider {
    const material =
      env.LOCAL_KEK_BASE64 ?? Buffer.from('firstround-dev-only-kek-32b!!').toString('base64');
    const version = Number(env.LOCAL_KEK_VERSION ?? '1');
    return new LocalKeyProvider([{ version, material }], version);
  }

  async current(): Promise<KeyEncryptionKey> {
    return this.get(this.currentVersion);
  }

  async get(version: number): Promise<KeyEncryptionKey> {
    const key = this.keys.find((k) => k.version === version);
    if (!key) throw new Error(`Unknown key version ${version}`);
    return key;
  }
}

function keyBytes(key: KeyEncryptionKey): Buffer {
  const buf = Buffer.from(key.material, 'base64');
  if (buf.length !== 32) {
    throw new Error('KEK must decode to 32 bytes');
  }
  return buf;
}

export async function seal(plaintext: string, provider: KeyProvider): Promise<EncryptedBlob> {
  const kek = await provider.current();
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(kek), nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64'),
    nonce: nonce.toString('base64'),
    keyVersion: kek.version,
  };
}

export async function open(blob: EncryptedBlob, provider: KeyProvider): Promise<string> {
  const kek = await provider.get(blob.keyVersion);
  const raw = Buffer.from(blob.ciphertext, 'base64');
  const nonce = Buffer.from(blob.nonce, 'base64');
  const data = raw.subarray(0, raw.length - 16);
  const tag = raw.subarray(raw.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(kek), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
