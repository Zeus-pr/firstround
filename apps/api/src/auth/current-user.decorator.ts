import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthUser } from './auth-user.js';
import type { AuthedRequest } from './firebase-auth.guard.js';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user?.uid) {
    throw new UnauthorizedException('Missing authenticated user');
  }
  return req.user;
});
