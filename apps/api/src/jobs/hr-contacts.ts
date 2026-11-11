export type HrContact = {
  fullName: string;
  title: string | null;
  companyName: string;
  email: string;
};

const LEGAL_SUFFIX =
  /\b(private limited|pvt\.?\s*ltd\.?|pvt|ltd|limited|inc|llc|llp|corp|corporation)\b/g;

/** Words that may trail a company name without making it a different company. */
const TRAILING = new Set([
  'india',
  'technologies',
  'technology',
  'solutions',
  'services',
  'group',
  'global',
  'labs',
  'systems',
  'software',
  'infotech',
  'enterprises',
  'holdings',
  'international',
  'consulting',
  'consultancy',
  'digital',
]);

/** Same key for a job company and a stored HR company. */
export function companyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(LEGAL_SUFFIX, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Same company after formatting differences.
 * A one-letter spelling change stays a miss, so a letter cannot go to the wrong firm.
 */
export function sameCompany(a: string, b: string): boolean {
  const left = companyKey(a);
  const right = companyKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const foldedLeft = left.replace(/ /g, '');
  const foldedRight = right.replace(/ /g, '');
  if (foldedLeft === foldedRight && foldedLeft.length >= 8) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (!longer.startsWith(`${shorter} `)) return false;
  const extra = longer.slice(shorter.length + 1).split(' ');
  if (!extra.every((token) => TRAILING.has(token))) return false;
  const stem = shorter
    .split(' ')
    .filter((token) => !TRAILING.has(token))
    .join('');
  return stem.length >= 5;
}

function oneFamily(keys: string[]): boolean {
  if (keys.length <= 1) return true;
  const shortest = keys.reduce((a, b) => (a.length <= b.length ? a : b));
  return keys.every((item) => item === shortest || sameCompany(shortest, item));
}

function titleRank(title: string | null): number {
  const text = (title ?? '').toLowerCase();
  if (/talent acquisition|talent accelerator|recruit/.test(text)) return 0;
  if (/\btalent\b/.test(text)) return 1;
  if (/human resource|\bhr\b|people/.test(text)) return 2;
  return 3;
}

/** One contact for the company. Talent-acquisition titles win. No match stays blank. */
export function pickHrContact(companyName: string, contacts: HrContact[]): HrContact | null {
  const key = companyKey(companyName);
  if (!key) return null;
  const pool = contacts.filter(
    (contact) => contact.email && sameCompany(companyName, contact.companyName),
  );
  if (pool.length === 0) return null;
  const keys = [...new Set(pool.map((contact) => companyKey(contact.companyName)))];
  const exact = pool.filter((contact) => companyKey(contact.companyName) === key);
  const usable = exact.length > 0 ? exact : oneFamily(keys) ? pool : [];
  if (usable.length === 0) return null;
  return [...usable].sort((a, b) => {
    const rank = titleRank(a.title) - titleRank(b.title);
    if (rank !== 0) return rank;
    return a.fullName.localeCompare(b.fullName);
  })[0]!;
}
