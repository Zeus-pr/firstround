import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const root = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(root, 'migrations');

const sql = postgres(connectionString, { max: 1, prepare: false });
const db = drizzle(sql);

await migrate(db, { migrationsFolder });
await sql.end({ timeout: 5 });
console.log('Migrations applied:', migrationsFolder);
