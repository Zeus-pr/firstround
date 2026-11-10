import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SessionService } from '../session/session.service.js';
import { ReviewService } from './review.service.js';

const SaveBody = z.object({
  body: z.string().min(1).max(20_000),
  subject: z.string().trim().min(1).max(180).optional(),
});

const ApproveBody = z.object({
  body: z.string().min(1).max(20_000).optional(),
  // Client may send these; server ignores them (U8 AE3).
  jobCanonicalId: z.string().optional(),
  recipientEmail: z.string().optional(),
  personName: z.string().optional(),
});

@Controller('review')
export class ReviewController {
  constructor(
    private readonly review: ReviewService,
    private readonly sessions: SessionService,
  ) {}

  @Get('today')
  @UseGuards(FirebaseAuthGuard)
  async today(@CurrentUser() auth: AuthUser) {
    const user = await this.sessions.ensureUser(auth);
    return this.review.listToday(user);
  }

  @Put('drafts/:id')
  @UseGuards(FirebaseAuthGuard)
  async save(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(SaveBody)) body: z.infer<typeof SaveBody>,
  ) {
    const user = await this.sessions.ensureUser(auth);
    return this.review.saveBody(user, id, body.body, body.subject);
  }

  @Post('drafts/:id/cancel')
  @UseGuards(FirebaseAuthGuard)
  async cancel(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    const user = await this.sessions.ensureUser(auth);
    return this.review.cancel(user, id);
  }

  @Post('drafts/:id/approve')
  @UseGuards(FirebaseAuthGuard)
  async approve(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(ApproveBody)) body: z.infer<typeof ApproveBody>,
  ) {
    const user = await this.sessions.ensureUser(auth);
    return this.review.approve(user, id, body.body);
  }
}
