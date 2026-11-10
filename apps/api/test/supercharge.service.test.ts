import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@firstround/db';
import type { CvFacts } from '@firstround/contracts';
import { CreditsService } from '../src/credits/credits.service.js';
import { CvService } from '../src/cv/cv.service.js';
import { suggestCvLines } from '../src/cv/suggest-cv.js';
import { scoreCvReadiness } from '../src/readiness/scorer.js';
import { SessionService } from '../src/session/session.service.js';
import type { StorageService } from '../src/files/storage.service.js';

vi.mock('../src/cv/suggest-cv.js', async () => {
  const actual =
    await vi.importActual<typeof import('../src/cv/suggest-cv.js')>('../src/cv/suggest-cv.js');
  return { ...actual, suggestCvLines: vi.fn() };
});

const migrationsFolder = path.join(process.cwd(), '../../packages/db/migrations');

const facts: CvFacts = {
  fullName: 'Asha Rao',
  emails: ['asha@example.com'],
  phones: [],
  locations: ['Bengaluru'],
  links: { linkedin: 'https://linkedin.com/in/asha', other: [] },
  summary:
    'Product manager who ships onboarding and checkout experiments with the data already on this CV.',
  skills: ['TypeScript', 'Product', 'SQL', 'Experimentation', 'Roadmaps'],
  roles: [
    {
      title: 'Senior Product Manager',
      company: 'Acme',
      startDate: '2021-01',
      endDate: null,
      isCurrent: true,
      bullets: [
        'Grew activation 18% in two quarters by redesigning onboarding.',
        'Led a 6-person squad shipping weekly experiments on checkout.',
      ],
      tools: ['Amplitude', 'SQL', 'Figma'],
      metrics: ['18% activation lift'],
      scope: 'Consumer checkout',
    },
    {
      title: 'Product Manager',
      company: 'Beta',
      startDate: '2018-06',
      endDate: '2020-12',
      isCurrent: false,
      bullets: ['Cut support tickets 22% by clarifying pricing pages.'],
      tools: ['Mixpanel'],
      metrics: ['22% ticket drop'],
    },
  ],
  education: [{ school: 'IIT', degree: 'B.Tech', endDate: '2018' }],
  targetRoleHints: ['product manager'],
};

describe('CvService.supercharge', () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let cv: CvService;
  let userId = '';
  let workspaceId = '';
  let firebaseUid = '';
  let cvDocumentId = '';

  beforeAll(async () => {
    process.env.XAI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    const sessions = new SessionService(db as never);
    const user = await sessions.ensureUser({
      uid: 'supercharge-uid',
      email: 'asha@example.com',
      emailVerified: true,
    });
    userId = user.id;
    workspaceId = user.workspaceId;
    firebaseUid = user.firebaseUid;
    cv = new CvService(db as never, {} as StorageService, new CreditsService(db as never));

    const readiness = scoreCvReadiness(facts, ['product']);
    const [doc] = await db
      .insert(schema.cvDocuments)
      .values({
        userId,
        fileKey: `${userId}/${firebaseUid}/cv.pdf`,
        contentType: 'application/pdf',
        sizeBytes: 1200,
        status: 'analyzed',
      })
      .returning({ id: schema.cvDocuments.id });
    cvDocumentId = doc!.id;
    const [extraction] = await db
      .insert(schema.cvExtractions)
      .values({
        cvDocumentId,
        userId,
        schemaVersion: 'cv-facts-v2',
        modelVersion: 'grok-4.3',
        promptVersion: 'cv-extract-v2',
        facts,
        meta: { confidence: readiness.confidence, parse: readiness.parse },
      })
      .returning({ id: schema.cvExtractions.id });
    await db.insert(schema.cvReadinessScores).values({
      userId,
      cvDocumentId,
      extractionId: extraction!.id,
      total: 75,
      dimensions: readiness.dimensions,
      gaps: readiness.gaps,
      sendability: {
        ...readiness.sendability,
        band: 'supercharge',
        recommendation: readiness.recommendation,
        genuineGaps: readiness.genuineGaps,
        underEmphasised: readiness.underEmphasised,
        checks: readiness.checks,
        confidence: readiness.confidence,
        parse: readiness.parse,
        normalized: readiness.normalized,
      },
      algorithmVersion: readiness.algorithmVersion,
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it('keeps the stored 75 and saves grounded suggestions without a new score', async () => {
    vi.mocked(suggestCvLines).mockResolvedValue({
      modelVersion: 'grok-4.20-0309-non-reasoning',
      suggestions: ['Move the 18% activation result to the first Acme bullet.'],
    });

    const result = await cv.supercharge(
      {
        id: userId,
        workspaceId,
        firebaseUid,
        email: 'asha@example.com',
        displayName: null,
        onboardingStep: 'readiness',
        created: false,
      },
      cvDocumentId,
    );

    expect(result.readiness.total).toBe(75);
    expect(result.suggestions).toEqual([
      'Move the 18% activation result to the first Acme bullet.',
    ]);
    expect(result.creditsCharged).toBe(0);

    const scores = await db.select().from(schema.cvReadinessScores);
    expect(scores).toHaveLength(1);
    expect(scores[0]?.total).toBe(75);

    const latest = await cv.latestReadiness(userId);
    expect(latest?.readiness.total).toBe(75);
    expect(latest?.suggestions).toEqual(result.suggestions);
  });

  it('falls back to the algorithm gaps when the model fails and still keeps 75', async () => {
    vi.mocked(suggestCvLines).mockRejectedValue(new Error('timeout'));
    const result = await cv.supercharge(
      {
        id: userId,
        workspaceId,
        firebaseUid,
        email: 'asha@example.com',
        displayName: null,
        onboardingStep: 'readiness',
        created: false,
      },
      cvDocumentId,
    );
    expect(result.readiness.total).toBe(75);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.join(' ')).not.toMatch(/99/);
    const scores = await db.select().from(schema.cvReadinessScores);
    expect(scores).toHaveLength(1);
  });
});
