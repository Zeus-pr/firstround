import { Controller, Get, Param, Post, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { clientIp, createIpRateLimiter } from '../auth/rate-limit.js';
import { SessionService } from '../session/session.service.js';
import { DeskRunService } from './desk-run.service.js';

const runLimiter = createIpRateLimiter(10, 60_000);

@Controller('desk')
export class DeskRunController {
  constructor(
    private readonly deskRun: DeskRunService,
    private readonly sessions: SessionService,
  ) {}

  @Post('run')
  @UseGuards(FirebaseAuthGuard)
  async run(@CurrentUser() auth: AuthUser, @Req() req: Request) {
    if (!runLimiter(clientIp(req))) {
      throw new HttpException('Too many desk runs', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.sessions.ensureUser(auth);
    return this.deskRun.runToday(user);
  }

  @Get('run/:id')
  @UseGuards(FirebaseAuthGuard)
  async status(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    const user = await this.sessions.ensureUser(auth);
    return this.deskRun.getRun(user, id);
  }
}
