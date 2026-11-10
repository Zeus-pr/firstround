import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module.js';
import { CatalogService } from './catalog.service.js';
import { PreferencesController } from './preferences.controller.js';
import { PreferencesService } from './preferences.service.js';

@Module({
  imports: [SessionModule],
  controllers: [PreferencesController],
  providers: [PreferencesService, CatalogService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
