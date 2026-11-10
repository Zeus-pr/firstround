import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { UpdatePreferencesRequest, type PreferencesResponse } from '@firstround/contracts';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SessionService } from '../session/session.service.js';
import { CatalogService } from './catalog.service.js';
import { CATALOG_KINDS } from './catalog-seed.js';
import { PreferencesService } from './preferences.service.js';

const AddOption = z.object({
  kind: z.enum(CATALOG_KINDS),
  label: z.string().trim().min(2).max(80),
});

@Controller('preferences')
@UseGuards(FirebaseAuthGuard)
export class PreferencesController {
  constructor(
    private readonly preferences: PreferencesService,
    private readonly catalog: CatalogService,
    private readonly sessions: SessionService,
  ) {}

  @Get('catalog')
  async catalogLists() {
    return { ok: true as const, lists: await this.catalog.lists() };
  }

  @Post('catalog')
  async addOption(@Body(new ZodPipe(AddOption)) body: z.infer<typeof AddOption>) {
    return { ok: true as const, lists: await this.catalog.add(body.kind, body.label) };
  }

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
