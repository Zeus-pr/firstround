import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import type { SqlClient } from '@firstround/db';
import { SQL } from './db.module.js';

@Injectable()
export class DbShutdownService implements OnModuleDestroy {
  constructor(@Optional() @Inject(SQL) private readonly sql: SqlClient | null) {}

  async onModuleDestroy() {
    if (this.sql) {
      await this.sql.end({ timeout: 5 });
    }
  }
}
