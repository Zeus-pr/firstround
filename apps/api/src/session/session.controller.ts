import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionResponse } from '@firstround/contracts';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { clientIp, createIpRateLimiter } from '../auth/rate-limit.js';
import { SessionService } from './session.service.js';

const allowSession = createIpRateLimiter(120, 60 * 60 * 1000);

@Controller('session')
@UseGuards(FirebaseAuthGuard)
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  private assertRate(req: Request) {
    if (!allowSession(clientIp(req))) {
      throw new ServiceUnavailableException({
        error: 'Too many session requests. Wait a while, then try again.',
      });
    }
  }

  /** Upsert the signed-in Firebase user into Postgres (call after signup/signin). */
  @Post()
  @HttpCode(200)
  async create(@Req() req: Request, @CurrentUser() auth: AuthUser): Promise<SessionResponse> {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    return { ok: true, user };
  }

  /** Same as POST /session: return the app user, creating the row if needed. */
  @Get('me')
  async me(@Req() req: Request, @CurrentUser() auth: AuthUser): Promise<SessionResponse> {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    return { ok: true, user };
  }
}
