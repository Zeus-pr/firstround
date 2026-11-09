import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

export function createSql(connectionString = process.env.DATABASE_URL, max = 5) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return postgres(connectionString, { max, prepare: false });
}

export function createDb(connectionString = process.env.DATABASE_URL) {
  const client = createSql(connectionString);
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Db = ReturnType<typeof createDb>['db'];
