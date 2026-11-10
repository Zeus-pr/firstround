import type OpenAI from 'openai';

const POLISH_MODEL = 'grok-4.20-0309-non-reasoning';

const BANNED =
  /my background fits|as an ai|scraping under the hood|\bleverage\b|\bdelve\b|i hope this|i've been working with|i am writing to express/i;

export type LetterRole = {
  title: string;
  company?: string | null;
  isCurrent?: boolean;
  bullets?: string[];
};

export type LetterCv = {
  fullName?: string | null;
  phones?: string[];
  links?: { linkedin?: string | null };
  roles?: LetterRole[];
};

export type LetterJob = {
  company: string;
  role: string;
  sourceUrl: string | null;
};

export type ComposedLetter = {
  body: string;
  evidenceFacts: string[];
  priorCompanies: string[];
  source: string;
};

function personName(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function currentRole(cv: LetterCv): LetterRole | null {
  return cv.roles?.find((r) => r.isCurrent) ?? cv.roles?.[0] ?? null;
}

/** Prefer bullets that already contain a number. Keep the source wording. */
export function proofBullets(bullets: string[] | undefined, limit = 2): string[] {
  const clean = (bullets ?? []).map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const numbered = clean.filter((b) => /\d/.test(b));
  return (numbered.length > 0 ? numbered : clean).slice(0, limit);
}

export function numbersIn(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

export function letterIsGrounded(body: string, source: string): boolean {
  if (BANNED.test(body)) return false;
  const allowed = new Set(numbersIn(source));
  return numbersIn(body).every((n) => allowed.has(n));
}

export function linkOnOwnLine(body: string, url: string | null): boolean {
  if (/\(link here\)/i.test(body)) return false;
  if (!url) return true;
  return body.split('\n').some((line) => line.trim() === url);
}

export function composeLetter(cv: LetterCv, job: LetterJob): ComposedLetter {
  const role = currentRole(cv);
  const bits = proofBullets(role?.bullets);
  const name = personName(cv.fullName);
  const phone = cv.phones?.find((p) => p.trim())?.trim() ?? null;
  const linkedin = cv.links?.linkedin?.trim() || null;
  const lines: string[] = [
    'Hi,',
    '',
    `I'm writing about the ${job.role} opening at ${job.company}.`,
    '',
  ];
  if (job.sourceUrl) {
    lines.push(job.sourceUrl, '');
  }
  lines.push("I'd like to be considered.");
  if (bits.length > 0) {
    lines.push('', 'A bit about me:', '');
    for (const bit of bits) lines.push(bit, '');
  } else {
    lines.push('');
  }
  lines.push('If you are still hiring, can we talk?', '');
  if (name) lines.push(name);
  if (phone) lines.push(phone);
  if (linkedin) lines.push(linkedin);

  const priorCompanies = [
    ...new Set(
      (cv.roles ?? []).map((r) => r.company?.trim()).filter((c): c is string => Boolean(c)),
    ),
  ];
  const body = `${lines.join('\n').trim()}\n`;
  const source = [
    body,
    job.company,
    job.role,
    job.sourceUrl ?? '',
    name ?? '',
    phone ?? '',
    linkedin ?? '',
  ].join('\n');
  return { body, evidenceFacts: bits, priorCompanies, source };
}

export async function polishLetter(
  client: OpenAI,
  body: string,
  source: string,
  job: LetterJob,
): Promise<string | null> {
  const res = await client.chat.completions.create({
    model: POLISH_MODEL,
    temperature: 0.2,
    max_tokens: 700,
    messages: [
      {
        role: 'system',
        content:
          'Edit this job letter for brevity and line breaks only. Keep every number, name, company, and URL exactly as written. Do not add facts, companies, or metrics. Put the job URL on its own line, not inside a sentence. No "I hope this finds you", no "my background fits". Return only the letter.',
      },
      { role: 'user', content: `SOURCE:\n${source}\n\nLETTER:\n${body}` },
    ],
  });
  const text = res.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  const next = text.endsWith('\n') ? text : `${text}\n`;
  if (!letterIsGrounded(next, source)) return null;
  if (!linkOnOwnLine(next, job.sourceUrl)) return null;
  if (!next.toLowerCase().includes(job.company.toLowerCase())) return null;
  if (!next.toLowerCase().includes(job.role.toLowerCase())) return null;
  return next;
}

export async function finalizeLetter(
  composed: ComposedLetter,
  job: LetterJob,
  polish?: () => Promise<string | null>,
): Promise<string> {
  if (!polish) return composed.body;
  try {
    const next = await Promise.race([
      polish(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
    if (
      next &&
      letterIsGrounded(next, composed.source) &&
      linkOnOwnLine(next, job.sourceUrl) &&
      next.toLowerCase().includes(job.company.toLowerCase())
    ) {
      return next;
    }
  } catch {
    /* keep the grounded letter */
  }
  return composed.body;
}
