import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@firstround/db';
import { SUPERCHARGE_CREDIT_COST } from '@firstround/contracts';
import { CreditsService } from '../src/credits/credits.service.js';
import { SessionService } from '../src/session/session.service.js';

const migrationsFolder = path.join(process.cwd(), '../../packages/db/migrations');

describe('CreditsService', () => {
  let client: PGlite;
  let credits: CreditsService;
  let sessions: SessionService;

  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    credits = new CreditsService(db as never);
    sessions = new SessionService(db as never);
  });

  afterAll(async () => {
    await client.close();
  });

  it('grants test credits and debits Supercharge once per reason', async () => {
    const user = await sessions.ensureUser({
      uid: 'credit-uid-1',
      email: 'credits@example.com',
      emailVerified: true,
    });
    process.env.CREDITS_TEST_MODE = '1';
    await credits.ensureTestGrant(user.workspaceId, user.id);
    const before = await credits.balance(user.workspaceId);
    expect(before).toBeGreaterThanOrEqual(SUPERCHARGE_CREDIT_COST);

    const first = await credits.debitOnce({
      workspaceId: user.workspaceId,
      userId: user.id,
      amount: SUPERCHARGE_CREDIT_COST,
      reason: 'cv_supercharge:doc:ext',
    });
    expect(first.charged).toBe(SUPERCHARGE_CREDIT_COST);
    expect(first.balance).toBe(before - SUPERCHARGE_CREDIT_COST);

    const second = await credits.debitOnce({
      workspaceId: user.workspaceId,
      userId: user.id,
      amount: SUPERCHARGE_CREDIT_COST,
      reason: 'cv_supercharge:doc:ext',
    });
    expect(second.charged).toBe(0);
    expect(second.balance).toBe(first.balance);
  });
});
