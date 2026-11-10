import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { campaignDrafts, campaigns, type Db } from '@firstround/db';
import type { SessionUser } from '@firstround/contracts';
import { DB } from '../db/db.module.js';
import {
  approveDraft,
  expirePendingAtCutoff,
  type DraftEvidence,
  type StoredDraft,
} from './draft.js';

@Injectable()
export class ReviewService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  async listToday(user: SessionUser) {
    const db = this.ready();
    const now = new Date();
    const rows = await db
      .select()
      .from(campaignDrafts)
      .where(eq(campaignDrafts.userId, user.id))
      .orderBy(desc(campaignDrafts.createdAt))
      .limit(50);

    const expired = expirePendingAtCutoff(
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        expiresAt: r.expiresAt,
      })),
      now,
    );
    for (const row of expired) {
      if (row.status === 'expired') {
        await db
          .update(campaignDrafts)
          .set({ status: 'expired', updatedAt: now })
          .where(and(eq(campaignDrafts.id, row.id), eq(campaignDrafts.status, 'pending_approval')));
      }
    }

    const fresh = await db
      .select()
      .from(campaignDrafts)
      .where(eq(campaignDrafts.userId, user.id))
      .orderBy(desc(campaignDrafts.createdAt))
      .limit(50);

    const drafts = fresh.map((row) => {
      const evidence = (row.evidence ?? {}) as DraftEvidence & { subject?: string };
      return {
        id: row.id,
        campaignId: row.campaignId,
        body: row.body,
        status: row.status,
        specificity: row.specificity,
        draftHash: row.draftHash,
        company: evidence.company ?? '',
        role: evidence.role ?? '',
        subject: evidence.subject ?? '',
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      };
    });

    return { ok: true as const, drafts };
  }

  async saveBody(user: SessionUser, draftId: string, body: string, subject?: string) {
    const db = this.ready();
    const [row] = await db
      .select()
      .from(campaignDrafts)
      .where(and(eq(campaignDrafts.id, draftId), eq(campaignDrafts.userId, user.id)))
      .limit(1);
    if (!row) throw new NotFoundException('Draft not found');
    if (row.status !== 'pending_approval') {
      throw new BadRequestException(`Draft is ${row.status}`);
    }
    const evidence = {
      ...(row.evidence ?? {}),
      ...(subject !== undefined ? { subject } : {}),
    };
    const [updated] = await db
      .update(campaignDrafts)
      .set({ body, evidence, updatedAt: new Date() })
      .where(eq(campaignDrafts.id, draftId))
      .returning();
    return { ok: true as const, draft: updated };
  }

  async cancel(user: SessionUser, draftId: string) {
    const db = this.ready();
    const [row] = await db
      .select()
      .from(campaignDrafts)
      .where(and(eq(campaignDrafts.id, draftId), eq(campaignDrafts.userId, user.id)))
      .limit(1);
    if (!row) throw new NotFoundException('Draft not found');
    if (row.status !== 'pending_approval') {
      throw new BadRequestException(`Draft is ${row.status}`);
    }
    const now = new Date();
    const [updated] = await db
      .update(campaignDrafts)
      .set({ status: 'cancelled', updatedAt: now })
      .where(eq(campaignDrafts.id, draftId))
      .returning();
    await db
      .update(campaigns)
      .set({ state: 'cancelled_by_user', updatedAt: now })
      .where(and(eq(campaigns.id, row.campaignId), eq(campaigns.userId, user.id)));
    return { ok: true as const, draft: updated };
  }

  async approve(user: SessionUser, draftId: string, body?: string) {
    const db = this.ready();
    const [row] = await db
      .select()
      .from(campaignDrafts)
      .where(and(eq(campaignDrafts.id, draftId), eq(campaignDrafts.userId, user.id)))
      .limit(1);
    if (!row) throw new NotFoundException('Draft not found');

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, row.campaignId), eq(campaigns.userId, user.id)))
      .limit(1);
    if (!campaign) throw new ForbiddenException('Campaign not owned by user');

    const evidence = (row.evidence ?? {}) as DraftEvidence;
    const stored: StoredDraft = {
      campaignId: row.campaignId,
      body: body ?? row.body,
      status: row.status as StoredDraft['status'],
      draftHash: row.draftHash,
      specificity: row.specificity,
      evidence: {
        company: evidence.company ?? '',
        role: evidence.role ?? '',
        person: evidence.person ?? '',
        evidenceFacts: Array.isArray(evidence.evidenceFacts) ? evidence.evidenceFacts : [],
      },
      jobCanonicalId: campaign.jobCanonicalId ?? '',
      recipientEmail: campaign.recipientEmail ?? '',
      personName: evidence.person ?? '',
    };

    const result = approveDraft(stored, {
      body,
      recipientEmail: 'ignored@example.com',
      jobCanonicalId: 'ignored',
    });
    if (!result.ok) {
      throw new BadRequestException(result.reason);
    }

    const [updated] = await db
      .update(campaignDrafts)
      .set({
        body: result.draft.body,
        draftHash: result.draft.draftHash,
        specificity: result.draft.specificity,
        status: 'approved',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaignDrafts.id, draftId))
      .returning();

    if (!result.idempotent) {
      await db
        .update(campaigns)
        .set({
          state: 'approved',
          draftHash: result.draft.draftHash,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, row.campaignId));
    }

    return { ok: true as const, draft: updated, idempotent: result.idempotent };
  }
}
