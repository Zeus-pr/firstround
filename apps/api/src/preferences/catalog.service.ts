import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { preferenceCatalog, type Db } from '@firstround/db';
import { DB } from '../db/db.module.js';
import { CATALOG_KINDS, CATALOG_SEED, type CatalogKind } from './catalog-seed.js';

export type CatalogLists = Record<CatalogKind, string[]>;

function merge(kind: CatalogKind, extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of [...CATALOG_SEED[kind], ...extra]) {
    const key = label.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label.trim());
  }
  return out.sort((a, b) => a.localeCompare(b));
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  private ready(): Db {
    if (!this.db) throw new ServiceUnavailableException('Database is not configured');
    return this.db;
  }

  async lists(): Promise<CatalogLists> {
    const db = this.ready();
    const rows = await db
      .select({ kind: preferenceCatalog.kind, label: preferenceCatalog.label })
      .from(preferenceCatalog)
      .orderBy(asc(preferenceCatalog.label));
    const extra: Record<string, string[]> = {};
    for (const row of rows) {
      (extra[row.kind] ??= []).push(row.label);
    }
    return Object.fromEntries(
      CATALOG_KINDS.map((kind) => [kind, merge(kind, extra[kind] ?? [])]),
    ) as CatalogLists;
  }

  async add(kind: string, label: string): Promise<CatalogLists> {
    if (!CATALOG_KINDS.includes(kind as CatalogKind)) {
      throw new BadRequestException('Unknown list');
    }
    const clean = label.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 80) {
      throw new BadRequestException('Use 2 to 80 characters');
    }
    const db = this.ready();
    await db.insert(preferenceCatalog).values({ kind, label: clean }).onConflictDoNothing();
    return this.lists();
  }
}
