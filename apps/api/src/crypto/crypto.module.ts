import { Global, Module } from '@nestjs/common';
import { LocalKeyProvider } from './envelope.js';

export const KEY_PROVIDER = Symbol('KEY_PROVIDER');

@Global()
@Module({
  providers: [
    {
      provide: KEY_PROVIDER,
      useFactory: () => LocalKeyProvider.fromEnv(),
    },
  ],
  exports: [KEY_PROVIDER],
})
export class CryptoModule {}
