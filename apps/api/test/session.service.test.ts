import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@firstround/db';
import { SessionService } from '../src/session/session.service.js';

const migrationsFolder = path.join(process.cwd(), '../../packages/db/migrations');

describe('SessionService.ensureUser', () => {
  let client: PGlite;
  let service: SessionService;

  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    service = new SessionService(db as never);
  });

  afterAll(async () => {
    await client.close();
  });

  it('creates workspace, user, and profile on first auth', async () => {
    const user = await service.ensureUser({
      uid: 'firebase-uid-1',
      email: 'a@example.com',
      emailVerified: true,
    });
    expect(user.created).toBe(true);
    expect(user.email).toBe('a@example.com');
    expect(user.onboardingStep).toBe('account');
    expect(user.firebaseUid).toBe('firebase-uid-1');
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('returns the same user on second call without creating again', async () => {
    const first = await service.ensureUser({
      uid: 'firebase-uid-2',
      email: 'b@example.com',
      emailVerified: true,
    });
    const second = await service.ensureUser({
      uid: 'firebase-uid-2',
      email: 'b@example.com',
      emailVerified: true,
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(second.workspaceId).toBe(first.workspaceId);
  });
});
