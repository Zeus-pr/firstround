import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AnalyzeCvRequest,
  RegisterCvRequest,
  SuperchargeCvRequest,
  type AnalyzeCvResponse,
  type RegisterCvResponse,
  type SuperchargeCvResponse,
} from '@firstround/contracts';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { clientIp, createIpRateLimiter } from '../auth/rate-limit.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SessionService } from '../session/session.service.js';
import { CvService } from './cv.service.js';

const allowCv = createIpRateLimiter(40, 60 * 60 * 1000);

@Controller('cv')
@UseGuards(FirebaseAuthGuard)
export class CvController {
  constructor(
    private readonly cv: CvService,
    private readonly sessions: SessionService,
  ) {}

  private assertRate(req: Request) {
    if (!allowCv(clientIp(req))) {
      throw new ServiceUnavailableException({
        error: 'Too many CV requests. Wait a while, then try again.',
      });
    }
  }

  @Post('register')
  @HttpCode(200)
  async register(
    @Req() req: Request,
    @CurrentUser() auth: AuthUser,
    @Body(new ZodPipe(RegisterCvRequest)) body: RegisterCvRequest,
  ): Promise<RegisterCvResponse> {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    return this.cv.register(user, body);
  }

  @Post('analyze')
  @HttpCode(200)
  async analyze(
    @Req() req: Request,
    @CurrentUser() auth: AuthUser,
    @Body(new ZodPipe(AnalyzeCvRequest)) body: AnalyzeCvRequest,
  ): Promise<AnalyzeCvResponse> {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    return this.cv.analyze(user, body.cvDocumentId);
  }

  @Post('suggestions')
  @HttpCode(200)
  async suggestions(
    @Req() req: Request,
    @CurrentUser() auth: AuthUser,
    @Body(new ZodPipe(SuperchargeCvRequest)) body: SuperchargeCvRequest,
  ): Promise<SuperchargeCvResponse> {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    return this.cv.supercharge(user, body.cvDocumentId);
  }

  @Post('supercharge')
  @HttpCode(200)
  async supercharge(
    @Req() req: Request,
    @CurrentUser() auth: AuthUser,
    @Body(new ZodPipe(SuperchargeCvRequest)) body: SuperchargeCvRequest,
  ): Promise<SuperchargeCvResponse> {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    return this.cv.supercharge(user, body.cvDocumentId);
  }

  @Get('readiness/latest')
  async latest(@Req() req: Request, @CurrentUser() auth: AuthUser) {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    const latest = await this.cv.latestReadiness(user.id);
    return {
      ok: true as const,
      readiness: latest?.readiness ?? null,
      cvDocumentId: latest?.cvDocumentId ?? null,
      cvFilename: latest?.cvFilename ?? null,
      suggestions: latest?.suggestions ?? [],
    };
  }

  @Get('documents/:id/download')
  async download(@Req() req: Request, @CurrentUser() auth: AuthUser, @Param('id') id: string) {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    return this.cv.downloadUrl(user, id);
  }

  @Delete('documents/:id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @CurrentUser() auth: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertRate(req);
    const user = await this.sessions.ensureUser(auth);
    return this.cv.removeDocument(user, id);
  }
}
