import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Shared ops bearer for ingest/cron. Set OPS_TOKEN on the api service.
 * Candidate Firebase sessions cannot call these routes.
 */
@Injectable()
export class OpsTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.OPS_TOKEN?.trim();
    if (!expected) {
      throw new ServiceUnavailableException('OPS_TOKEN is not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing ops Bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid ops token');
    }
    return true;
  }
}
