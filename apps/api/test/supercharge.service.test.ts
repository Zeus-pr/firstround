import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@firstround/db';
import type { CvFacts } from '@firstround/contracts';
import { CreditsService } from '../src/credits/credits.service.js';
import { CvService } from '../src/cv/cv.service.js';
import { superchargeCvWithGrok } from '../src/cv/grok-supercharge.js';
import { scoreCvReadiness } from '../src/readiness/scorer.js';
import { SessionService } from '../src/session/session.service.js';
import type { StorageService } from '../src/files/storage.service.js';

vi.mock('../src/cv/grok-supercharge.js', () => ({
  superchargeCvWithGrok: vi.fn(),
}));

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
  let cv: CvService;
  let userId = '';
  let workspaceId = '';
  let firebaseUid = '';
  let cvDocumentId = '';

  beforeAll(async () => {
    process.env.XAI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';
    client = new PGlite();
    const db = drizzle(client, { schema });
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

  it('keeps a stored 75 when the model returns a weaker CV', async () => {
    vi.mocked(superchargeCvWithGrok).mockResolvedValue({
      modelVersion: 'grok-4.7',
      rewrittenText:
        'Asha Rao raised revenue 99% after dropping the dated roles. This text is intentionally worse.',
      facts: {
        ...facts,
        emails: [],
        summary: 'Raised revenue 99% somewhere else entirely and dropped the proof.',
        roles: [
          {
            title: 'Senior Product Manager',
            company: 'Acme',
            startDate: '2019-01',
            endDate: '2020-01',
            isCurrent: false,
            bullets: ['Did stuff.', 'Raised revenue 99%.'],
            tools: [],
            metrics: ['99% revenue'],
          },
        ],
        education: [],
      },
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

    expect(result.readiness.total).toBeGreaterThanOrEqual(75);
    expect(result.readiness.total).not.toBe(72);
    expect(JSON.stringify(result.facts)).not.toMatch(/99/);
    expect(result.rewrittenText).not.toMatch(/99/);
    expect(result.facts.roles[0]?.startDate).toBe('2021-01');
    expect(result.facts.roles).toHaveLength(2);
    expect(result.creditsCharged).toBe(0);

    const latest = await cv.latestReadiness(userId);
    expect(latest?.readiness.total).toBeGreaterThanOrEqual(75);
    expect(latest?.readiness.total).toBe(result.readiness.total);
  });
});
