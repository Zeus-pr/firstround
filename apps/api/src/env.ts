import { z } from 'zod';

const nonEmpty = z.string().trim().min(1, 'is required');
const intStr = z.string().regex(/^\d+$/, 'must be a whole number');

/**
 * Production environment. Validated once at boot; fatal on any problem.
 * Dev and test stay lenient. Messages carry variable NAMES only, never values.
 */
export const ProdEnv = z.object({
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, 'must be a postgres:// connection string'),
  WEB_ORIGIN: z.string().refine((v) => {
    const list = v
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    return (
      list.length > 0 &&
      list.every((o) => {
        try {
          const u = new URL(o);
          return (u.protocol === 'https:' || u.protocol === 'http:') && u.origin === o;
        } catch {
          return false;
        }
      })
    );
  }, 'must be a comma-separated list of origins (no path, no wildcard)'),
  PORT: intStr.optional(),
  LOCAL_KEK_BASE64: nonEmpty.optional(),
  LOCAL_KEK_VERSION: intStr.optional(),
  R2_ACCOUNT_ID: nonEmpty,
  R2_ACCESS_KEY_ID: nonEmpty,
  R2_SECRET_ACCESS_KEY: nonEmpty,
  R2_BUCKET: nonEmpty,
  R2_ENDPOINT: z.string().url().optional(),
  FIREBASE_PROJECT_ID: nonEmpty,
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .refine((v) => v.includes('BEGIN PRIVATE KEY') || v.includes('BEGIN RSA PRIVATE KEY'), {
      message: 'must be a PEM private key (use \\n for newlines in env)',
    }),
});

export type ProdEnv = z.infer<typeof ProdEnv>;

export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const parsed = ProdEnv.safeParse(env);
  if (parsed.success) return;
  const names = parsed.error.issues.map((i) => i.path.join('.') || '(root)');
  throw new Error(`Invalid production environment: ${[...new Set(names)].join(', ')}`);
}

export function webOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.WEB_ORIGIN ?? 'http://localhost:3000';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
