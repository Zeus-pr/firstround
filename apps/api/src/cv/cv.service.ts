import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import {
  cvDocuments,
  cvExtractions,
  cvReadinessScores,
  preferences,
  profiles,
  type Db,
} from '@firstround/db';
import {
  SUPERCHARGE_CREDIT_COST,
  type AnalyzeCvResponse,
  type ReadinessResult,
  type RegisterCvRequest,
  type RegisterCvResponse,
  type SessionUser,
  type SuperchargeCvResponse,
  CvFacts,
} from '@firstround/contracts';
import { CreditsService } from '../credits/credits.service.js';
import { DB } from '../db/db.module.js';
import { StorageService } from '../files/storage.service.js';
import { scoreCvReadiness } from '../readiness/scorer.js';
import { createGrokClient, extractCvFactsWithGrok } from './grok-extract.js';
import { superchargeCvWithGrok } from './grok-supercharge.js';
import { extractTextFromCv } from './parse-document.js';

type ScoreRow = typeof cvReadinessScores.$inferSelect;

/** Rebuild LetterProof payload from the score row (extras live in sendability jsonb). */
function hydrateReadinessFromScore(row: ScoreRow): ReadinessResult {
  const blob = (row.sendability ?? {}) as Record<string, unknown>;
  const dimensions = row.dimensions as ReadinessResult['dimensions'];
  const recommendation = (blob.recommendation ?? {
    action: 'strengthen',
    headline: 'LetterProof on file',
    body: 'Open the CV seat to review this score.',
  }) as ReadinessResult['recommendation'];
  const band = (
    typeof blob.band === 'string' ? blob.band : recommendation.action
  ) as ReadinessResult['band'];
  return {
    total: row.total,
    dimensions: {
      evidenceCompleteness: Number(dimensions?.evidenceCompleteness ?? 0),
      outcomeQuality: Number(dimensions?.outcomeQuality ?? 0),
      targetRoleCoverage: Number(dimensions?.targetRoleCoverage ?? 0),
      careerConsistency: Number(dimensions?.careerConsistency ?? 0),
      communicationClarity: Number(dimensions?.communicationClarity ?? 0),
    },
    gaps: Array.isArray(row.gaps) ? row.gaps : [],
    genuineGaps: Array.isArray(blob.genuineGaps) ? (blob.genuineGaps as string[]) : [],
    underEmphasised: Array.isArray(blob.underEmphasised) ? (blob.underEmphasised as string[]) : [],
    checks: Array.isArray(blob.checks) ? (blob.checks as ReadinessResult['checks']) : [],
    sendability: {
      ok: Boolean(blob.ok),
      hasEmail: Boolean(blob.hasEmail),
      hasLocation: Boolean(blob.hasLocation),
      hasWorkingLink: Boolean(blob.hasWorkingLink),
      blockers: Array.isArray(blob.blockers) ? (blob.blockers as string[]) : [],
    },
    confidence: (blob.confidence ?? { overall: 0.5, notes: [] }) as ReadinessResult['confidence'],
    parse: (blob.parse ?? {
      method: 'text',
      quality: 'medium',
      textChars: 0,
      pageEstimate: 0,
      pagesRendered: 0,
      multiColumnSuspected: false,
      sparseText: false,
      ocrUsed: false,
      visionUsed: false,
      notes: [],
    }) as ReadinessResult['parse'],
    normalized: (blob.normalized ?? {
      taxonomyVersion: 'taxonomy-v1',
      skills: [],
      tools: [],
      roleFamilies: [],
    }) as ReadinessResult['normalized'],
    recommendation,
    algorithmVersion: row.algorithmVersion as ReadinessResult['algorithmVersion'],
    band,
  };
}

@Injectable()
export class CvService {
  constructor(
    @Inject(DB) private readonly db: Db | null,
    private readonly storage: StorageService,
    private readonly credits: CreditsService,
  ) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  async register(user: SessionUser, body: RegisterCvRequest): Promise<RegisterCvResponse> {
    const db = this.ready();
    const prefix = body.fileKey.split('/')[1];
    if (prefix !== user.firebaseUid) {
      throw new BadRequestException('fileKey does not belong to this account');
    }
    const head = await this.storage.head(body.fileKey);
    if (!head) throw new NotFoundException('Upload not found in storage');

    const [doc] = await db
      .insert(cvDocuments)
      .values({
        userId: user.id,
        fileKey: body.fileKey,
        contentType: body.contentType,
        sizeBytes: body.sizeBytes,
        originalFilename: body.originalFilename ?? null,
        status: 'uploaded',
      })
      .returning({ id: cvDocuments.id, fileKey: cvDocuments.fileKey });
    if (!doc) throw new ServiceUnavailableException('Could not save CV record');

    await db
      .update(profiles)
      .set({ onboardingStep: 'cv', updatedAt: new Date() })
      .where(eq(profiles.userId, user.id));

    return {
      ok: true,
      cvDocumentId: doc.id,
      fileKey: doc.fileKey,
      onboardingStep: 'cv',
    };
  }

  async analyze(user: SessionUser, cvDocumentId: string): Promise<AnalyzeCvResponse> {
    const db = this.ready();
    const grok = createGrokClient();
    if (!grok) {
      throw new ServiceUnavailableException(
        'CV analysis is not configured yet (missing XAI_API_KEY)',
      );
    }

    const [doc] = await db
      .select()
      .from(cvDocuments)
      .where(and(eq(cvDocuments.id, cvDocumentId), eq(cvDocuments.userId, user.id)))
      .limit(1);
    if (!doc) throw new NotFoundException('CV not found');

    const { bytes, contentType } = await this.storage.getObjectBytes(user.firebaseUid, doc.fileKey);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await db
      .update(cvDocuments)
      .set({ sha256, status: 'analyzing', updatedAt: new Date() })
      .where(eq(cvDocuments.id, doc.id));

    const parsed = await extractTextFromCv(bytes, contentType ?? doc.contentType);
    if (parsed.text.length < 40 && parsed.pages.length === 0) {
      throw new BadRequestException('That file has almost no readable text. Try another export.');
    }
    if (parsed.pageEstimate > 12) {
      throw new BadRequestException('Keep the CV under 12 pages for analysis.');
    }

    const extracted = await extractCvFactsWithGrok(parsed.text, grok, {
      pages: parsed.pages,
      parse: parsed.parse,
    });

    const parse = {
      ...parsed.parse,
      visionUsed: extracted.visionUsed || parsed.parse.visionUsed,
      ocrUsed: false,
      method: extracted.visionUsed ? ('vision' as const) : parsed.parse.method,
      notes: [
        ...parsed.parse.notes,
        ...(extracted.visionUsed ? ['Vision pass used for layout-aware extraction.'] : []),
      ].slice(0, 12),
    };

    const [pref] = await db
      .select({ jobFamilies: preferences.jobFamilies })
      .from(preferences)
      .where(eq(preferences.userId, user.id))
      .limit(1);

    const readiness = scoreCvReadiness(extracted.facts, pref?.jobFamilies ?? [], {
      parse,
      confidence: extracted.confidence,
    });

    const [extraction] = await db
      .insert(cvExtractions)
      .values({
        cvDocumentId: doc.id,
        userId: user.id,
        schemaVersion: extracted.schemaVersion,
        modelVersion: extracted.modelVersion,
        promptVersion: extracted.promptVersion,
        facts: extracted.facts,
        meta: {
          pageEstimate: parsed.pageEstimate,
          charCount: parsed.text.length,
          parse,
          confidence: extracted.confidence,
          normalized: readiness.normalized,
        },
      })
      .returning({ id: cvExtractions.id });
    if (!extraction) throw new ServiceUnavailableException('Could not save extraction');

    await db.insert(cvReadinessScores).values({
      userId: user.id,
      cvDocumentId: doc.id,
      extractionId: extraction.id,
      total: readiness.total,
      dimensions: readiness.dimensions,
      gaps: readiness.gaps,
      sendability: {
        ...readiness.sendability,
        band: readiness.band,
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

    await db
      .update(cvDocuments)
      .set({ status: 'analyzed', updatedAt: new Date() })
      .where(eq(cvDocuments.id, doc.id));
    await db
      .update(profiles)
      .set({ onboardingStep: 'readiness', updatedAt: new Date() })
      .where(eq(profiles.userId, user.id));

    return {
      ok: true,
      cvDocumentId: doc.id,
      extractionId: extraction.id,
      readiness,
      facts: extracted.facts,
      onboardingStep: 'readiness',
    };
  }

  async latestReadiness(userId: string) {
    const db = this.ready();
    const [row] = await db
      .select()
      .from(cvReadinessScores)
      .where(eq(cvReadinessScores.userId, userId))
      .orderBy(desc(cvReadinessScores.createdAt))
      .limit(1);
    if (!row) return null;
    return {
      readiness: hydrateReadinessFromScore(row),
      cvDocumentId: row.cvDocumentId,
    };
  }

  async supercharge(user: SessionUser, cvDocumentId: string): Promise<SuperchargeCvResponse> {
    const db = this.ready();
    const grok = createGrokClient();
    if (!grok) {
      throw new ServiceUnavailableException(
        'CV analysis is not configured yet (missing XAI_API_KEY)',
      );
    }

    const [doc] = await db
      .select()
      .from(cvDocuments)
      .where(and(eq(cvDocuments.id, cvDocumentId), eq(cvDocuments.userId, user.id)))
      .limit(1);
    if (!doc) throw new NotFoundException('CV not found');

    const [latestScore] = await db
      .select()
      .from(cvReadinessScores)
      .where(and(eq(cvReadinessScores.cvDocumentId, doc.id), eq(cvReadinessScores.userId, user.id)))
      .orderBy(desc(cvReadinessScores.createdAt))
      .limit(1);
    if (!latestScore) {
      throw new BadRequestException('Analyze the CV before Supercharge.');
    }

    const [extraction] = await db
      .select()
      .from(cvExtractions)
      .where(and(eq(cvExtractions.id, latestScore.extractionId), eq(cvExtractions.userId, user.id)))
      .limit(1);
    if (!extraction) throw new NotFoundException('Extraction not found');

    const facts = CvFacts.parse(extraction.facts);
    const priorReadiness = scoreCvReadiness(facts, []);
    // Prefer stored gaps/band from sendability blob when present.
    const stored = latestScore.sendability as Record<string, unknown>;
    if (typeof stored.band === 'string') {
      priorReadiness.band = stored.band as typeof priorReadiness.band;
    }
    if (Array.isArray(stored.genuineGaps)) {
      priorReadiness.genuineGaps = stored.genuineGaps as string[];
    }
    if (Array.isArray(stored.underEmphasised)) {
      priorReadiness.underEmphasised = stored.underEmphasised as string[];
    }
    priorReadiness.total = latestScore.total;
    priorReadiness.gaps = latestScore.gaps ?? priorReadiness.gaps;

    const debit = await this.credits.debitOnce({
      workspaceId: user.workspaceId,
      userId: user.id,
      amount: SUPERCHARGE_CREDIT_COST,
      reason: `cv_supercharge:${doc.id}:${extraction.id}`,
    });

    const boosted = await superchargeCvWithGrok({
      client: grok,
      facts,
      readiness: priorReadiness,
    });

    const [pref] = await db
      .select({ jobFamilies: preferences.jobFamilies })
      .from(preferences)
      .where(eq(preferences.userId, user.id))
      .limit(1);

    const readiness = scoreCvReadiness(boosted.facts, pref?.jobFamilies ?? []);

    const [nextExtraction] = await db
      .insert(cvExtractions)
      .values({
        cvDocumentId: doc.id,
        userId: user.id,
        schemaVersion: extraction.schemaVersion,
        modelVersion: boosted.modelVersion,
        promptVersion: 'cv-supercharge-v1',
        facts: boosted.facts,
        meta: {
          superchargedFrom: extraction.id,
          rewrittenText: boosted.rewrittenText,
          creditsCharged: debit.charged,
        },
      })
      .returning({ id: cvExtractions.id });
    if (!nextExtraction) throw new ServiceUnavailableException('Could not save supercharge');

    await db.insert(cvReadinessScores).values({
      userId: user.id,
      cvDocumentId: doc.id,
      extractionId: nextExtraction.id,
      total: readiness.total,
      dimensions: readiness.dimensions,
      gaps: readiness.gaps,
      sendability: {
        ...readiness.sendability,
        band: readiness.band,
        recommendation: readiness.recommendation,
        genuineGaps: readiness.genuineGaps,
        underEmphasised: readiness.underEmphasised,
        checks: readiness.checks,
        confidence: readiness.confidence,
        parse: readiness.parse,
        normalized: readiness.normalized,
        supercharged: true,
      },
      algorithmVersion: readiness.algorithmVersion,
    });

    await db
      .update(profiles)
      .set({ onboardingStep: 'readiness', updatedAt: new Date() })
      .where(eq(profiles.userId, user.id));

    return {
      ok: true,
      cvDocumentId: doc.id,
      extractionId: nextExtraction.id,
      readiness,
      facts: boosted.facts,
      rewrittenText: boosted.rewrittenText,
      creditsCharged: debit.charged,
      creditBalance: debit.balance,
      onboardingStep: 'readiness',
    };
  }
}
