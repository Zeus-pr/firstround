export type HrContact = {
  fullName: string;
  title: string | null;
  companyName: string;
  email: string;
};

const LEGAL_SUFFIX =
  /\b(private limited|pvt\.?\s*ltd\.?|pvt|ltd|limited|inc|llc|llp|corp|corporation)\b/g;

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
    (contact) => companyKey(contact.companyName) === key && contact.email,
  );
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const rank = titleRank(a.title) - titleRank(b.title);
    if (rank !== 0) return rank;
    return a.fullName.localeCompare(b.fullName);
  })[0]!;
}
