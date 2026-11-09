import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user.js';
import { FirebaseAuthService } from './firebase-auth.service.js';

export type AuthedRequest = Request & { user?: AuthUser };

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly auth: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    req.user = await this.auth.verifyIdToken(token);
    return true;
  }
}
