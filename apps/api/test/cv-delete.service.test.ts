import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@firstround/db';
import type { SessionUser } from '@firstround/contracts';
import { CreditsService } from '../src/credits/credits.service.js';
import { CvService } from '../src/cv/cv.service.js';
import { SessionService } from '../src/session/session.service.js';
import type { StorageService } from '../src/files/storage.service.js';

const migrationsFolder = path.join(process.cwd(), '../../packages/db/migrations');

describe('CvService.removeDocument', () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let cv: CvService;
  let removed: string[];
  let owner: SessionUser;
  let other: SessionUser;
  let documentId = '';

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    const sessions = new SessionService(db as never);
    const first = await sessions.ensureUser({
      uid: 'delete-owner',
      email: 'owner@example.com',
      emailVerified: true,
    });
    const second = await sessions.ensureUser({
      uid: 'delete-other',
      email: 'other@example.com',
      emailVerified: true,
    });
    owner = first;
    other = second;
    removed = [];
    const storage = {
      remove: async (key: string) => {
        removed.push(key);
      },
    } as unknown as StorageService;
    cv = new CvService(db as never, storage, new CreditsService(db as never));

    const [doc] = await db
      .insert(schema.cvDocuments)
      .values({
        userId: owner.id,
        fileKey: `cv/${owner.firebaseUid}/2026/11/cv.pdf`,
        contentType: 'application/pdf',
        sizeBytes: 1200,
        originalFilename: 'owner.pdf',
        status: 'analyzed',
      })
      .returning({ id: schema.cvDocuments.id });
    documentId = doc!.id;
    const [extraction] = await db
      .insert(schema.cvExtractions)
      .values({
        cvDocumentId: documentId,
        userId: owner.id,
        schemaVersion: 'cv-facts-v2',
        modelVersion: 'test',
        promptVersion: 'cv-extract-v2',
        facts: { fullName: 'Owner' },
        meta: {},
      })
      .returning({ id: schema.cvExtractions.id });
    await db.insert(schema.cvReadinessScores).values({
      userId: owner.id,
      cvDocumentId: documentId,
      extractionId: extraction!.id,
      total: 73,
      dimensions: {},
      gaps: [],
      sendability: {},
      algorithmVersion: 'test',
    });
    await db
      .update(schema.profiles)
      .set({ onboardingStep: 'readiness' })
      .where(eq(schema.profiles.userId, owner.id));
  });

  afterAll(async () => {
    await client.close();
  });

  it('rejects another account without deleting the file or the score', async () => {
    await expect(cv.removeDocument(other, documentId)).rejects.toMatchObject({
      status: 404,
    });
    expect(removed).toEqual([]);
    const docs = await db.select().from(schema.cvDocuments);
    expect(docs).toHaveLength(1);
    const scores = await db.select().from(schema.cvReadinessScores);
    expect(scores).toHaveLength(1);
  });

  it('deletes the owner CV, its score, and the stored file', async () => {
    const result = await cv.removeDocument(owner, documentId);
    expect(result).toEqual({ ok: true });
    expect(removed).toEqual([`cv/${owner.firebaseUid}/2026/11/cv.pdf`]);
    expect(await db.select().from(schema.cvDocuments)).toEqual([]);
    expect(await db.select().from(schema.cvExtractions)).toEqual([]);
    expect(await db.select().from(schema.cvReadinessScores)).toEqual([]);
    expect(await cv.latestReadiness(owner.id)).toBeNull();
    const [profile] = await db
      .select({ step: schema.profiles.onboardingStep })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, owner.id));
    expect(profile?.step).toBe('account');
  });

  it('returns not found once the CV is already gone', async () => {
    await expect(cv.removeDocument(owner, documentId)).rejects.toMatchObject({ status: 404 });
  });
});
