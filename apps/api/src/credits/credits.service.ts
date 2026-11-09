import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { SUPERCHARGE_CREDIT_COST } from '@firstround/contracts';
import { creditLedger, type Db } from '@firstround/db';
import { DB } from '../db/db.module.js';

@Injectable()
export class CreditsService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  testMode(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.CREDITS_TEST_MODE === '1' || env.NODE_ENV !== 'production';
  }

  async balance(workspaceId: string): Promise<number> {
    const db = this.ready();
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)`.mapWith(Number),
      })
      .from(creditLedger)
      .where(eq(creditLedger.workspaceId, workspaceId));
    return row?.total ?? 0;
  }

  async ensureTestGrant(workspaceId: string, userId: string): Promise<void> {
    if (!this.testMode()) return;
    const bal = await this.balance(workspaceId);
    if (bal >= SUPERCHARGE_CREDIT_COST) return;
    const db = this.ready();
    await db.insert(creditLedger).values({
      workspaceId,
      userId,
      delta: 100,
      reason: 'test_grant',
    });
  }

  /**
   * Debit credits once per idempotency key (reason). Returns amount charged (0 if already billed).
   */
  async debitOnce(opts: {
    workspaceId: string;
    userId: string;
    amount: number;
    reason: string;
  }): Promise<{ charged: number; balance: number }> {
    const db = this.ready();
    await this.ensureTestGrant(opts.workspaceId, opts.userId);

    const [existing] = await db
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(
        and(eq(creditLedger.workspaceId, opts.workspaceId), eq(creditLedger.reason, opts.reason)),
      )
      .limit(1);
    if (existing) {
      return { charged: 0, balance: await this.balance(opts.workspaceId) };
    }

    const bal = await this.balance(opts.workspaceId);
    if (bal < opts.amount) {
      throw new HttpException(
        {
          error: `Need ${opts.amount} credits. Balance is ${bal}.`,
          balance: bal,
          required: opts.amount,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    await db.insert(creditLedger).values({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
      delta: -opts.amount,
      reason: opts.reason,
    });
    return { charged: opts.amount, balance: await this.balance(opts.workspaceId) };
  }
}
