import { Global, Module } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';
import { FirebaseAuthService } from './firebase-auth.service.js';

@Global()
@Module({
  providers: [FirebaseAuthService, FirebaseAuthGuard],
  exports: [FirebaseAuthService, FirebaseAuthGuard],
})
export class AuthModule {}
