import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module.js';
import { CreditsController } from './credits.controller.js';
import { CreditsService } from './credits.service.js';

@Module({
  imports: [SessionModule],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
