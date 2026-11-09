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
import type {
  AnalyzeCvResponse,
  RegisterCvRequest,
  RegisterCvResponse,
  SessionUser,
} from '@firstround/contracts';
import { DB } from '../db/db.module.js';
import { StorageService } from '../files/storage.service.js';
import { scoreCvReadiness } from '../readiness/scorer.js';
import { createGrokClient, extractCvFactsWithGrok } from './grok-extract.js';
import { extractTextFromCv } from './parse-document.js';

@Injectable()
export class CvService {
  constructor(
    @Inject(DB) private readonly db: Db | null,
    private readonly storage: StorageService,
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

    const { text, pageEstimate } = await extractTextFromCv(bytes, contentType ?? doc.contentType);
    if (text.length < 40) {
      throw new BadRequestException('That file has almost no readable text. Try another export.');
    }
    if (pageEstimate > 12) {
      throw new BadRequestException('Keep the CV under 12 pages for analysis.');
    }

    const extracted = await extractCvFactsWithGrok(text, grok);
    const [pref] = await db
      .select({ jobFamilies: preferences.jobFamilies })
      .from(preferences)
      .where(eq(preferences.userId, user.id))
      .limit(1);

    const readiness = scoreCvReadiness(extracted.facts, pref?.jobFamilies ?? []);

    const [extraction] = await db
      .insert(cvExtractions)
      .values({
        cvDocumentId: doc.id,
        userId: user.id,
        schemaVersion: extracted.schemaVersion,
        modelVersion: extracted.modelVersion,
        promptVersion: extracted.promptVersion,
        facts: extracted.facts,
        meta: { pageEstimate, charCount: text.length },
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
      sendability: readiness.sendability,
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
    return row ?? null;
  }
}
