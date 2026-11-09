import { Module } from '@nestjs/common';
import { FakeJobSource, FakeMailSender, FakeVerifier } from './fakes.js';

@Module({
  providers: [FakeJobSource, FakeMailSender, FakeVerifier],
  exports: [FakeJobSource, FakeMailSender, FakeVerifier],
})
export class ProvidersModule {}
