import { Controller, Get, Inject, Optional, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { HealthDbOk, HealthOk } from '@firstround/contracts';
import type { Db } from '@firstround/db';
import { DB } from '../db/db.module.js';

@Controller('health')
export class HealthController {
  constructor(@Optional() @Inject(DB) private readonly db: Db | null) {}

  @Get()
  get(): HealthOk {
    return { ok: true, service: 'firstround', phase: '0' };
  }

  @Get('db')
  async getDb(): Promise<HealthDbOk> {
    if (!this.db) {
      throw new ServiceUnavailableException({ ok: false, database: 'unconfigured' });
    }
    try {
      await this.db.execute(sql`select 1 as ok`);
      return { ok: true, database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ ok: false, database: 'down' });
    }
  }
}
