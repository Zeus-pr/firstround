import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module.js';
import { GmailController } from './gmail.controller.js';
import { GmailService } from './gmail.service.js';

@Module({
  imports: [SessionModule],
  controllers: [GmailController],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
