import { Module } from '@nestjs/common';
import { CampaignMachine } from './machine.js';

@Module({
  providers: [
    {
      provide: CampaignMachine,
      useFactory: () => new CampaignMachine(),
    },
  ],
  exports: [CampaignMachine],
})
export class CampaignModule {}
