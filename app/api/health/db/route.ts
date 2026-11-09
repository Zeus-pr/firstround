import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { createDb } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, database: 'unconfigured' }, { status: 503 });
  }

  try {
    const db = createDb();
    await db.execute(sql`select 1 as ok`);
    return NextResponse.json({ ok: true, database: 'up' });
  } catch {
    return NextResponse.json({ ok: false, database: 'down' }, { status: 503 });
  }
}
