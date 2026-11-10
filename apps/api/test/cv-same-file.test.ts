import { createHash } from 'node:crypto';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@firstround/db';
import type { SessionUser } from '@firstround/contracts';
import { CreditsService } from '../src/credits/credits.service.js';
import { CvService } from '../src/cv/cv.service.js';
import { SessionService } from '../src/session/session.service.js';
import type { StorageService } from '../src/files/storage.service.js';
import { extractCvFactsWithGrok } from '../src/cv/grok-extract.js';
import { extractTextFromCv } from '../src/cv/parse-document.js';

vi.mock('../src/cv/grok-extract.js', () => ({
  createGrokClient: vi.fn(() => ({})),
  extractCvFactsWithGrok: vi.fn(async () => {
    throw new Error('model');
  }),
}));

vi.mock('../src/cv/parse-document.js', () => ({
  extractTextFromCv: vi.fn(async () => {
    throw new Error('fresh-read');
  }),
}));

const migrationsFolder = path.join(process.cwd(), '../../packages/db/migrations');
const bytes = Buffer.from('same-cv-bytes-for-shubhayan');
const sha256 = createHash('sha256').update(bytes).digest('hex');

function storage(removed: string[]) {
  return {
    getObjectBytes: async () => ({ bytes, contentType: 'application/pdf' }),
    remove: async (key: string) => {
      removed.push(key);
    },
  } as unknown as StorageService;
}

async function userOf(sessions: SessionService, uid: string, email: string): Promise<SessionUser> {
  return sessions.ensureUser({ uid, email, emailVerified: true });
}

describe('CvService identical file', () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let cv: CvService;
  let owner: SessionUser;
  let other: SessionUser;
  let keptId = '';
  const removed: string[] = [];

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    const sessions = new SessionService(db as never);
    owner = await userOf(sessions, 'same-cv-owner', 'owner@example.com');
    other = await userOf(sessions, 'same-cv-other', 'other@example.com');
    cv = new CvService(db as never, storage(removed), new CreditsService(db as never));

    const [otherDoc] = await db
      .insert(schema.cvDocuments)
      .values({
        userId: other.id,
        fileKey: `cv/${other.firebaseUid}/2026/11/other.pdf`,
        contentType: 'application/pdf',
        sizeBytes: bytes.length,
        sha256,
        originalFilename: 'other.pdf',
        status: 'analyzed',
      })
      .returning({ id: schema.cvDocuments.id });
    const [otherExtraction] = await db
      .insert(schema.cvExtractions)
      .values({
        cvDocumentId: otherDoc!.id,
        userId: other.id,
        schemaVersion: 'cv-facts-v2',
        modelVersion: 'test',
        promptVersion: 'cv-extract-v2',
        facts: { fullName: 'Other Person', roles: [] },
        meta: {},
      })
      .returning({ id: schema.cvExtractions.id });
    await db.insert(schema.cvReadinessScores).values({
      userId: other.id,
      cvDocumentId: otherDoc!.id,
      extractionId: otherExtraction!.id,
      total: 40,
      dimensions: {},
      gaps: [],
      sendability: {
        band: 'strengthen',
        recommendation: { action: 'strengthen', headline: 'Needs work', body: 'Fix the gaps.' },
      },
      algorithmVersion: 'readiness-v2',
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it('does not reuse another account and does not keep a second copy of a known file', async () => {
    const [upload] = await db
      .insert(schema.cvDocuments)
      .values({
        userId: owner.id,
        fileKey: `cv/${owner.firebaseUid}/2026/11/first.pdf`,
        contentType: 'application/pdf',
        sizeBytes: bytes.length,
        originalFilename: 'first.pdf',
        status: 'uploaded',
      })
      .returning({ id: schema.cvDocuments.id });

    await expect(cv.analyze(owner, upload!.id)).rejects.toThrow('fresh-read');
    expect(removed).toEqual([]);
    const docs = await db
      .select({ id: schema.cvDocuments.id })
      .from(schema.cvDocuments)
      .where(eq(schema.cvDocuments.userId, owner.id));
    expect(docs).toHaveLength(1);
    expect(vi.mocked(extractCvFactsWithGrok)).not.toHaveBeenCalled();
  });

  it('returns the stored score for the same bytes and deletes the duplicate file', async () => {
    const [kept] = await db
      .insert(schema.cvDocuments)
      .values({
        userId: owner.id,
        fileKey: `cv/${owner.firebaseUid}/2026/11/kept.pdf`,
        contentType: 'application/pdf',
        sizeBytes: bytes.length,
        sha256,
        originalFilename: 'kept.pdf',
        status: 'analyzed',
      })
      .returning({ id: schema.cvDocuments.id });
    keptId = kept!.id;
    const [extraction] = await db
      .insert(schema.cvExtractions)
      .values({
        cvDocumentId: keptId,
        userId: owner.id,
        schemaVersion: 'cv-facts-v2',
        modelVersion: 'test',
        promptVersion: 'cv-extract-v2',
        facts: {
          fullName: 'Shubhayan Mitra',
          roles: [
            {
              title: 'Assistant Manager — Category & Revenue Management',
              company: 'Samsung',
              startDate: '2022-01',
              endDate: null,
              isCurrent: true,
              bullets: ['Owned a Rs. 250 Cr P&L.'],
            },
          ],
        },
        meta: {},
      })
      .returning({ id: schema.cvExtractions.id });
    await db.insert(schema.cvReadinessScores).values({
      userId: owner.id,
      cvDocumentId: keptId,
      extractionId: extraction!.id,
      total: 73,
      dimensions: {
        evidenceCompleteness: 70,
        outcomeQuality: 70,
        targetRoleCoverage: 70,
        careerConsistency: 70,
        communicationClarity: 70,
      },
      gaps: [],
      sendability: {
        ok: true,
        hasEmail: true,
        hasLocation: true,
        hasWorkingLink: true,
        blockers: [],
        band: 'supercharge',
        recommendation: {
          action: 'supercharge',
          headline: 'Good enough to start',
          body: 'You can keep going.',
        },
      },
      algorithmVersion: 'readiness-v2',
    });

    const duplicateKey = `cv/${owner.firebaseUid}/2026/11/again.pdf`;
    const [again] = await db
      .insert(schema.cvDocuments)
      .values({
        userId: owner.id,
        fileKey: duplicateKey,
        contentType: 'application/pdf',
        sizeBytes: bytes.length,
        originalFilename: 'again.pdf',
        status: 'uploaded',
      })
      .returning({ id: schema.cvDocuments.id });

    vi.mocked(extractTextFromCv).mockClear();
    vi.mocked(extractCvFactsWithGrok).mockClear();
    const result = await cv.analyze(owner, again!.id);
    expect(result.readiness.total).toBe(73);
    expect(result.cvDocumentId).toBe(keptId);
    expect(result.facts.fullName).toBe('Shubhayan Mitra');
    expect(removed).toEqual([duplicateKey]);
    expect(vi.mocked(extractTextFromCv)).not.toHaveBeenCalled();
    expect(vi.mocked(extractCvFactsWithGrok)).not.toHaveBeenCalled();

    const docs = await db
      .select({
        id: schema.cvDocuments.id,
        sha256: schema.cvDocuments.sha256,
        name: schema.cvDocuments.originalFilename,
      })
      .from(schema.cvDocuments)
      .where(eq(schema.cvDocuments.userId, owner.id));
    expect(docs.find((row) => row.id === again!.id)).toBeUndefined();
    expect(docs.find((row) => row.id === keptId)?.sha256).toBe(sha256);
    expect(docs.find((row) => row.id === keptId)?.name).toBe('again.pdf');

    const latest = await cv.latestReadiness(owner.id);
    expect(latest?.readiness.total).toBe(73);
    expect(latest?.cvDocumentId).toBe(keptId);
  });
});
