import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const file = path.join(process.cwd(), "data", "waitlist.ndjson");

export type SeatResult =
  | { ok: true; already: boolean }
  | { ok: false; error: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let chain: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) return null;
  return email;
}

export function saveSeat(email: string): Promise<SeatResult> {
  return enqueue(async () => {
    await mkdir(path.dirname(file), { recursive: true });
    let raw = "";
    try {
      raw = await readFile(file, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }

    const already = raw.split("\n").some((line) => {
      if (!line) return false;
      try {
        return (JSON.parse(line) as { email?: string }).email === email;
      } catch {
        return false;
      }
    });

    if (already) return { ok: true, already: true };

    await appendFile(
      file,
      `${JSON.stringify({ email, at: new Date().toISOString() })}\n`,
    );
    return { ok: true, already: false };
  });
}
