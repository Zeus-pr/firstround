import { Global, Module } from '@nestjs/common';
import { createDb, type Db, type SqlClient } from '@firstround/db';
import { DbShutdownService } from './db-shutdown.service.js';

export const DB = Symbol('DB');
export const SQL = Symbol('SQL');

type DbBundle = { db: Db; client: SqlClient };

@Global()
@Module({
  providers: [
    {
      provide: 'DB_BUNDLE',
      useFactory: (): DbBundle | null => {
        if (!process.env.DATABASE_URL) return null;
        return createDb();
      },
    },
    {
      provide: SQL,
      inject: ['DB_BUNDLE'],
      useFactory: (bundle: DbBundle | null): SqlClient | null => bundle?.client ?? null,
    },
    {
      provide: DB,
      inject: ['DB_BUNDLE'],
      useFactory: (bundle: DbBundle | null): Db | null => bundle?.db ?? null,
    },
    DbShutdownService,
  ],
  exports: [DB, SQL],
})
export class DbModule {}
