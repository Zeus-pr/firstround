import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { CampaignModule } from './campaign/campaign.module.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';

@Module({
  imports: [
    DbModule,
    CryptoModule,
    HealthModule,
    WaitlistModule,
    CampaignModule,
    ProvidersModule,
    AuditModule,
  ],
})
export class AppModule {}
