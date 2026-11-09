import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@firstround/db';
import { PreferencesService } from '../src/preferences/preferences.service.js';
import { SessionService } from '../src/session/session.service.js';

const migrationsFolder = path.join(process.cwd(), '../../packages/db/migrations');

describe('PreferencesService', () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let prefs: PreferencesService;
  let sessions: SessionService;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    prefs = new PreferencesService(db as never);
    sessions = new SessionService(db as never);
  });

  afterAll(async () => {
    await client.close();
  });

  it('returns empty preferences then upserts and advances onboarding', async () => {
    const user = await sessions.ensureUser({
      uid: 'prefs-uid-1',
      email: 'prefs@example.com',
      emailVerified: true,
    });
    await db
      .update(schema.profiles)
      .set({ onboardingStep: 'readiness' })
      .where(eq(schema.profiles.userId, user.id));

    const refreshed = { ...user, onboardingStep: 'readiness' as const };
    const empty = await prefs.get(refreshed);
    expect(empty.preferences.jobFamilies).toEqual([]);

    const saved = await prefs.upsert(refreshed, {
      jobFamilies: ['Product'],
      locations: ['Remote'],
      targetLevel: 'Mid',
      links: { linkedin: 'https://linkedin.com/in/example' },
    });
    expect(saved.preferences.jobFamilies).toEqual(['Product']);
    expect(saved.onboardingStep).toBe('gmail');

    const again = await prefs.get({ ...refreshed, onboardingStep: 'gmail' });
    expect(again.preferences.locations).toEqual(['Remote']);
    expect(again.preferences.links.linkedin).toBe('https://linkedin.com/in/example');
  });
});
