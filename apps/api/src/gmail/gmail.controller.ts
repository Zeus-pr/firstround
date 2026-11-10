import {
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { clientIp, createIpRateLimiter } from '../auth/rate-limit.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { webOrigins } from '../env.js';
import { SessionService } from '../session/session.service.js';
import { GmailService } from './gmail.service.js';

const startLimiter = createIpRateLimiter(20, 60_000);

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly gmail: GmailService,
    private readonly sessions: SessionService,
  ) {}

  @Get('status')
  @UseGuards(FirebaseAuthGuard)
  async status(@CurrentUser() auth: AuthUser) {
    const user = await this.sessions.ensureUser(auth);
    return this.gmail.status(user);
  }

  @Post('connect')
  @UseGuards(FirebaseAuthGuard)
  async connect(@CurrentUser() auth: AuthUser, @Req() req: Request) {
    if (!startLimiter(clientIp(req))) {
      throw new HttpException('Too many Gmail connect attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.sessions.ensureUser(auth);
    return this.gmail.startConnect(user);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      const desk = webOrigins()[0] ?? 'https://firstround.space';
      const url = new URL('/desk', desk);
      url.searchParams.set('gmail', 'error');
      url.searchParams.set('reason', String(error).slice(0, 80));
      return res.redirect(url.toString());
    }
    const redirectTo = await this.gmail.handleCallback(code, state);
    return res.redirect(redirectTo);
  }

  @Delete('disconnect')
  @UseGuards(FirebaseAuthGuard)
  async disconnect(@CurrentUser() auth: AuthUser) {
    const user = await this.sessions.ensureUser(auth);
    return this.gmail.disconnect(user);
  }
}
