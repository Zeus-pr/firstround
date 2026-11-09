import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { profiles, users, workspaces, type Db } from '@firstround/db';
import type { AuthUser } from '../auth/auth-user.js';
import { DB } from '../db/db.module.js';
import type { SessionUser } from '@firstround/contracts';

@Injectable()
export class SessionService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.db;
  }

  /** Create workspace + user + profile on first auth, or refresh email/name. */
  async ensureUser(auth: AuthUser): Promise<SessionUser> {
    const db = this.ready();
    const existing = await db
      .select({
        id: users.id,
        workspaceId: users.workspaceId,
        firebaseUid: users.firebaseUid,
        email: users.email,
        displayName: profiles.displayName,
        onboardingStep: profiles.onboardingStep,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.firebaseUid, auth.uid))
      .limit(1);

    if (existing[0]) {
      const row = existing[0];
      const email = auth.email ?? row.email;
      if (email !== row.email) {
        await db.update(users).set({ email, updatedAt: new Date() }).where(eq(users.id, row.id));
      }
      if (!row.onboardingStep) {
        await db.insert(profiles).values({ userId: row.id }).onConflictDoNothing();
      }
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        firebaseUid: row.firebaseUid,
        email: email ?? null,
        displayName: row.displayName ?? null,
        onboardingStep: row.onboardingStep ?? 'account',
        created: false,
      };
    }

    return db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspaces)
        .values({ name: auth.email ? `${auth.email}'s desk` : 'Personal desk' })
        .returning({ id: workspaces.id });
      if (!ws) throw new ServiceUnavailableException('Could not create workspace');

      const [user] = await tx
        .insert(users)
        .values({
          workspaceId: ws.id,
          firebaseUid: auth.uid,
          email: auth.email,
        })
        .returning({
          id: users.id,
          workspaceId: users.workspaceId,
          firebaseUid: users.firebaseUid,
          email: users.email,
        });
      if (!user) throw new ServiceUnavailableException('Could not create user');

      await tx.insert(profiles).values({
        userId: user.id,
        displayName: null,
        onboardingStep: 'account',
      });

      return {
        id: user.id,
        workspaceId: user.workspaceId,
        firebaseUid: user.firebaseUid,
        email: user.email ?? null,
        displayName: null,
        onboardingStep: 'account' as const,
        created: true,
      };
    });
  }
}
