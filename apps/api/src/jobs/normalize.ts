import { createHash } from 'node:crypto';

export const JOB_PARSER_VERSION = '1';
export const JOB_TRUST_VERSION = 'job-trust-1';
export const JOB_TRUST_MINIMUM = 75;

export type PosterType = 'direct' | 'consultancy' | 'confidential' | 'aggregator' | 'unknown';

/** JobsPipe / Apify row shape (fields may be null). */
export type ProviderJobRow = {
  id?: string | number | null;
  job_title?: string | null;
  normalized_title?: string | null;
  company?: string | null;
  company_domain?: string | null;
  url?: string | null;
  source_url?: string | null;
  location?: string | null;
  cities?: string[] | null;
  remote?: boolean | null;
  work_arrangement?: string | null;
  employment_statuses?: string[] | null;
  seniority?: string | null;
  description?: string | null;
  date_posted?: string | null;
  skills?: string[] | null;
  recruiter_emails?: string[] | null;
  sources?: Array<{ name?: string; url?: string } | string> | null;
  [key: string]: unknown;
};

export type NormalizedJob = {
  providerJobId: string;
  title: string;
  normalizedTitle: string | null;
  companyName: string;
  companyDomain: string | null;
  location: string | null;
  workMode: string | null;
  employmentType: string | null;
  seniority: string | null;
  descriptionText: string;
  sourceUrl: string | null;
  applicationUrl: string | null;
  postedAt: Date | null;
  posterType: PosterType;
  skills: string[];
  invitedEmail: string | null;
  invitedEmailSpan: string | null;
  fingerprint: string;
};

const FREE_MAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
]);

const FRAUD_PATTERNS =
  /\b(pay\s*(to\s*)?apply|registration\s*fee|crypto\s*wallet|send\s*(?:money|bitcoin)|buy\s*equipment|whatsapp\s*only\s*hiring)\b/i;

const CONSULTANCY =
  /\b(consultancy|consulting|staffing|recruitment\s+agency|for\s+our\s+client|client\s+location)\b/i;
const CONFIDENTIAL = /\b(confidential|employer\s+confidential|company\s+name\s+withheld)\b/i;

/** Strict invited-channel parser — never a model. */
export function parseInvitedEmail(text: string): { email: string; span: string } | null {
  if (!text) return null;
  const patterns: RegExp[] = [
    /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
    /([a-z0-9._%+-]+)\s*\[\s*at\s*\]\s*([a-z0-9.-]+)\s*(?:\[\s*dot\s*\]|\.)\s*([a-z]{2,})/i,
    /([a-z0-9._%+-]+)\s+at\s+([a-z0-9.-]+)\s+dot\s+([a-z]{2,})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    if (m[2] && m[3]) {
      const email = `${m[1]}@${m[2]}.${m[3]}`.toLowerCase();
      return { email, span: m[0] };
    }
    if (m[1]?.includes('@')) {
      return { email: m[1].toLowerCase(), span: m[0] };
    }
  }
  return null;
}

export function classifyPosterType(description: string, company: string): PosterType {
  const hay = `${company}\n${description}`;
  if (CONFIDENTIAL.test(hay)) return 'confidential';
  if (CONSULTANCY.test(hay)) return 'consultancy';
  if (/\b(aggregator|job\s*board\s*repost)\b/i.test(hay)) return 'aggregator';
  if (company.trim()) return 'direct';
  return 'unknown';
}

export function fingerprintJob(input: {
  companyDomain: string | null;
  companyName: string;
  normalizedTitle: string | null;
  title: string;
  location: string | null;
  descriptionText: string;
}): string {
  const company = (input.companyDomain || input.companyName).toLowerCase().trim();
  const title = (input.normalizedTitle || input.title).toLowerCase().trim();
  const location = (input.location || '').toLowerCase().trim();
  const desc = input.descriptionText.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 800);
  return createHash('sha256').update([company, title, location, desc].join('|')).digest('hex');
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t || null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeProviderJob(row: ProviderJobRow): NormalizedJob | null {
  const title = asString(row.job_title);
  const companyName = asString(row.company);
  if (!title || !companyName) return null;

  const providerJobId = row.id == null ? null : String(row.id).trim();
  if (!providerJobId) return null;

  const descriptionText = stripHtml(asString(row.description) ?? '');
  const companyDomain = asString(row.company_domain)?.toLowerCase() ?? null;
  const location =
    asString(row.location) ??
    (Array.isArray(row.cities) && row.cities[0] ? String(row.cities[0]) : null);
  const workMode =
    asString(row.work_arrangement) ??
    (row.remote === true ? 'remote' : row.remote === false ? 'onsite' : null);
  const employmentType = Array.isArray(row.employment_statuses)
    ? asString(row.employment_statuses[0] ?? null)
    : null;
  const seniority = asString(row.seniority);
  const sourceUrl = asString(row.url) ?? asString(row.source_url);
  const postedRaw = asString(row.date_posted);
  const postedAt = postedRaw && !Number.isNaN(Date.parse(postedRaw)) ? new Date(postedRaw) : null;
  const skills = Array.isArray(row.skills)
    ? row.skills
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 40)
    : [];

  const invitedFromList =
    Array.isArray(row.recruiter_emails) && row.recruiter_emails[0]
      ? {
          email: String(row.recruiter_emails[0]).toLowerCase(),
          span: String(row.recruiter_emails[0]),
        }
      : null;
  const invited = invitedFromList ?? parseInvitedEmail(descriptionText);
  const normalizedTitle = asString(row.normalized_title);
  const posterType = classifyPosterType(descriptionText, companyName);

  return {
    providerJobId,
    title,
    normalizedTitle,
    companyName,
    companyDomain,
    location,
    workMode,
    employmentType,
    seniority,
    descriptionText,
    sourceUrl,
    applicationUrl: sourceUrl,
    postedAt,
    posterType,
    skills,
    invitedEmail: invited?.email ?? null,
    invitedEmailSpan: invited?.span ?? null,
    fingerprint: fingerprintJob({
      companyDomain,
      companyName,
      normalizedTitle,
      title,
      location,
      descriptionText,
    }),
  };
}

export type TrustBreakdown = {
  companyIdentity: number;
  sourceReliability: number;
  freshness: number;
  applicationDomainSafety: number;
  descriptionQuality: number;
  fraudRiskAbsence: number;
};

export function scoreJobTrust(
  job: NormalizedJob,
  sourceKey: string,
): {
  score: number;
  breakdown: TrustBreakdown;
  quarantined: boolean;
} {
  const domain = job.companyDomain;
  let companyIdentity = 8;
  if (job.companyName.length >= 2) companyIdentity += 7;
  if (domain && domain.includes('.') && !FREE_MAIL.has(domain)) companyIdentity += 10;
  if (job.posterType === 'direct') companyIdentity += 0;
  if (job.posterType === 'consultancy' || job.posterType === 'confidential') companyIdentity -= 6;
  if (job.posterType === 'aggregator') companyIdentity -= 10;
  companyIdentity = clamp(companyIdentity, 0, 25);

  let sourceReliability = 8;
  if (sourceKey === 'naukri_apify' || sourceKey === 'linkedin_apify') sourceReliability += 8;
  if (job.sourceUrl?.startsWith('http')) sourceReliability += 4;
  if (job.title && job.companyName && job.descriptionText.length > 80) sourceReliability += 0;
  sourceReliability = clamp(sourceReliability, 0, 20);

  let freshness = 5;
  if (job.postedAt) {
    const ageDays = (Date.now() - job.postedAt.getTime()) / 86_400_000;
    if (ageDays <= 3) freshness = 15;
    else if (ageDays <= 14) freshness = 11;
    else if (ageDays <= 30) freshness = 7;
    else if (ageDays <= 45) freshness = 3;
    else freshness = 0;
  }
  freshness = clamp(freshness, 0, 15);

  let applicationDomainSafety = 6;
  if (domain && !FREE_MAIL.has(domain)) applicationDomainSafety += 6;
  if (
    job.applicationUrl?.includes('boards.greenhouse.io') ||
    job.applicationUrl?.includes('jobs.lever.co')
  ) {
    applicationDomainSafety += 3;
  }
  if (job.invitedEmail) {
    const invitedDomain = job.invitedEmail.split('@')[1] ?? '';
    if (FREE_MAIL.has(invitedDomain) && domain && !FREE_MAIL.has(domain))
      applicationDomainSafety -= 8;
    else applicationDomainSafety += 3;
  }
  applicationDomainSafety = clamp(applicationDomainSafety, 0, 15);

  let descriptionQuality = 2;
  if (job.descriptionText.length > 120) descriptionQuality += 3;
  if (job.descriptionText.length > 400) descriptionQuality += 2;
  if (job.location || job.workMode) descriptionQuality += 2;
  if (job.skills.length > 0) descriptionQuality += 1;
  descriptionQuality = clamp(descriptionQuality, 0, 10);

  let fraudRiskAbsence = 15;
  const fraudHit = FRAUD_PATTERNS.test(job.descriptionText);
  if (fraudHit) fraudRiskAbsence = 0;
  fraudRiskAbsence = clamp(fraudRiskAbsence, 0, 15);

  const breakdown: TrustBreakdown = {
    companyIdentity,
    sourceReliability,
    freshness,
    applicationDomainSafety,
    descriptionQuality,
    fraudRiskAbsence,
  };
  const score =
    companyIdentity +
    sourceReliability +
    freshness +
    applicationDomainSafety +
    descriptionQuality +
    fraudRiskAbsence;

  return {
    score,
    breakdown,
    // Fraud signals always quarantine even if other weights still sum high.
    quarantined: fraudHit || score < JOB_TRUST_MINIMUM,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
