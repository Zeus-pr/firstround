import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WaitlistRequest } from '@firstround/contracts';
import { clientIp, createIpRateLimiter } from '../auth/rate-limit.js';
import { WaitlistService } from './waitlist.service.js';

const allowed = createIpRateLimiter(8, 60 * 60 * 1000);

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @HttpCode(200)
  async create(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('content-type') contentType?: string,
  ) {
    if (!allowed(clientIp(req))) {
      throw new ServiceUnavailableException({
        error: 'Too many tries. Wait a while, then send it again.',
      });
    }

    let raw: unknown = '';
    let intent: 'signup' | 'login' = 'signup';

    if (contentType?.includes('application/json')) {
      const parsed = WaitlistRequest.safeParse(body);
      if (!parsed.success) {
        throw new BadRequestException({ error: 'Use a full email address.' });
      }
      raw = parsed.data.email;
      if (parsed.data.intent === 'login') intent = 'login';
    } else if (body && typeof body === 'object') {
      raw = (body as { email?: unknown }).email;
      if ((body as { intent?: unknown }).intent === 'login') intent = 'login';
    }

    const email = this.waitlist.normalizeEmail(raw);
    if (!email) {
      throw new BadRequestException({ error: 'Use a full email address.' });
    }

    if (intent === 'login') {
      const found = await this.waitlist.findSeat(email);
      if (!found) {
        throw new NotFoundException({ error: 'No seat under that address yet.' });
      }
      return { ok: true as const, already: true };
    }

    const saved = await this.waitlist.saveSeat(email);
    if (saved.ok && saved.already) {
      return { ok: true as const, already: true };
    }
    return { ok: true as const };
  }
}
