import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UpdatePreferencesRequest, type PreferencesResponse } from '@firstround/contracts';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SessionService } from '../session/session.service.js';
import { PreferencesService } from './preferences.service.js';

@Controller('preferences')
@UseGuards(FirebaseAuthGuard)
export class PreferencesController {
  constructor(
    private readonly preferences: PreferencesService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async get(@CurrentUser() auth: AuthUser): Promise<PreferencesResponse> {
    const user = await this.sessions.ensureUser(auth);
    return this.preferences.get(user);
  }

  @Put()
  async put(
    @CurrentUser() auth: AuthUser,
    @Body(new ZodPipe(UpdatePreferencesRequest)) body: UpdatePreferencesRequest,
  ): Promise<PreferencesResponse> {
    const user = await this.sessions.ensureUser(auth);
    return this.preferences.upsert(user, body);
  }
}
