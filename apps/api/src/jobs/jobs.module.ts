import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SessionModule } from '../session/session.module.js';
import { DeskRunController } from './desk-run.controller.js';
import { DeskRunService } from './desk-run.service.js';
import { GatesController } from './gates.controller.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { ReviewController } from './review.controller.js';
import { ReviewService } from './review.service.js';

@Module({
  imports: [AuthModule, SessionModule],
  controllers: [JobsController, GatesController, ReviewController, DeskRunController],
  providers: [JobsService, ReviewService, DeskRunService],
  exports: [JobsService, ReviewService, DeskRunService],
})
export class JobsModule {}
