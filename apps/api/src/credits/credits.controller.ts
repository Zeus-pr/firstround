import { Controller, Get, UseGuards } from '@nestjs/common';
import { SUPERCHARGE_CREDIT_COST, type CreditsBalanceResponse } from '@firstround/contracts';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { SessionService } from '../session/session.service.js';
import { CreditsService } from './credits.service.js';

@Controller('credits')
@UseGuards(FirebaseAuthGuard)
export class CreditsController {
  constructor(
    private readonly credits: CreditsService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async balance(@CurrentUser() auth: AuthUser): Promise<CreditsBalanceResponse> {
    const user = await this.sessions.ensureUser(auth);
    await this.credits.ensureTestGrant(user.workspaceId, user.id);
    const balance = await this.credits.balance(user.workspaceId);
    return {
      ok: true,
      balance,
      superchargeCost: SUPERCHARGE_CREDIT_COST,
      testMode: this.credits.testMode(),
    };
  }
}
