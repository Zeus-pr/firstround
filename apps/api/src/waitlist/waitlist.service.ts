import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';

export type SeatResult = { ok: true; already: boolean } | { ok: false; error: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class WaitlistService {
  private readonly file = path.join(process.cwd(), 'data', 'waitlist.ndjson');
  private chain: Promise<unknown> = Promise.resolve();

  normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !emailPattern.test(email)) return null;
    return email;
  }

  findSeat(email: string): Promise<boolean> {
    return this.enqueue(async () => this.listed(await this.readList(), email));
  }

  saveSeat(email: string): Promise<SeatResult> {
    return this.enqueue(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const raw = await this.readList();
      const already = this.listed(raw, email);
      if (already) return { ok: true as const, already: true };
      await appendFile(this.file, `${JSON.stringify({ email, at: new Date().toISOString() })}\n`);
      return { ok: true as const, already: false };
    });
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private listed(raw: string, email: string) {
    return raw.split('\n').some((line) => {
      if (!line) return false;
      try {
        return (JSON.parse(line) as { email?: string }).email === email;
      } catch {
        return false;
      }
    });
  }

  private async readList() {
    try {
      return await readFile(this.file, 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
      return '';
    }
  }
}
