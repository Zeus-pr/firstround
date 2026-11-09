import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CampaignModule } from './campaign/campaign.module.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { DbModule } from './db/db.module.js';
import { FilesModule } from './files/files.module.js';
import { HealthModule } from './health/health.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { SessionModule } from './session/session.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';

@Module({
  imports: [
    AuthModule,
    DbModule,
    CryptoModule,
    HealthModule,
    WaitlistModule,
    SessionModule,
    FilesModule,
    CampaignModule,
    ProvidersModule,
    AuditModule,
  ],
})
export class AppModule {}
