import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest';
import * as schema from '@firstround/db';
import { SUPERCHARGE_CREDIT_COST } from '@firstround/contracts';
import { CreditsService } from '../src/credits/credits.service.js';
import { SessionService } from '../src/session/session.service.js';

const migrationsFolder = path.join(process.cwd(), '../../packages/db/migrations');

describe('CreditsService', () => {
  let client: PGlite;
  let credits: CreditsService;
  let sessions: SessionService;
  const prevTestMode = process.env.CREDITS_TEST_MODE;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    credits = new CreditsService(db as never);
    sessions = new SessionService(db as never);
  });

  afterEach(() => {
    process.env.CREDITS_TEST_MODE = prevTestMode;
    process.env.NODE_ENV = prevNodeEnv;
  });

  afterAll(async () => {
    await client.close();
  });

  it('in test mode tops up and does not debit Supercharge', async () => {
    const user = await sessions.ensureUser({
      uid: 'credit-uid-1',
      email: 'credits@example.com',
      emailVerified: true,
    });
    process.env.CREDITS_TEST_MODE = '1';
    process.env.NODE_ENV = 'production';
    await credits.ensureTestGrant(user.workspaceId, user.id);
    const before = await credits.balance(user.workspaceId);
    expect(before).toBeGreaterThanOrEqual(1000);

    const first = await credits.debitOnce({
      workspaceId: user.workspaceId,
      userId: user.id,
      amount: SUPERCHARGE_CREDIT_COST,
      reason: 'cv_supercharge:doc:ext',
    });
    expect(first.charged).toBe(0);
    expect(first.balance).toBe(before);
  });

  it('in production mode debits once per reason', async () => {
    const user = await sessions.ensureUser({
      uid: 'credit-uid-2',
      email: 'credits2@example.com',
      emailVerified: true,
    });
    process.env.CREDITS_TEST_MODE = '0';
    process.env.NODE_ENV = 'production';

    const db = (credits as unknown as { db: ReturnType<typeof drizzle> }).db;
    await db.insert(schema.creditLedger).values({
      workspaceId: user.workspaceId,
      userId: user.id,
      delta: 20,
      reason: 'seed',
    });

    const first = await credits.debitOnce({
      workspaceId: user.workspaceId,
      userId: user.id,
      amount: SUPERCHARGE_CREDIT_COST,
      reason: 'cv_supercharge:doc2:ext2',
    });
    expect(first.charged).toBe(SUPERCHARGE_CREDIT_COST);
    expect(first.balance).toBe(20 - SUPERCHARGE_CREDIT_COST);

    const second = await credits.debitOnce({
      workspaceId: user.workspaceId,
      userId: user.id,
      amount: SUPERCHARGE_CREDIT_COST,
      reason: 'cv_supercharge:doc2:ext2',
    });
    expect(second.charged).toBe(0);
    expect(second.balance).toBe(first.balance);
  });
});
