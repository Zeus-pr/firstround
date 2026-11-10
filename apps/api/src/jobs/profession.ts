/** Profession is decided from the job title, or the current CV role. Description keywords do not count. */

export type Profession =
  'mainframe' | 'software' | 'data' | 'product' | 'design' | 'commercial' | 'other';

export type ProfessionCv = {
  roles?: Array<{ title?: string | null; isCurrent?: boolean }>;
  targetRoleHints?: string[];
  skills?: string[];
};

const MAINFRAME = /\b(mainframe|cobol|cics|rexx|\bjcl\b|as\/?400|\bims\b|\bvsam\b|\bdb2\b)\b/i;
const COMMERCIAL =
  /\b(category|merchandis\w*|revenue|pricing|assortment|\bgtm\b|go[\s-]?to[\s-]?market|demand planner|buyer)\b/i;
const PRODUCT = /\bproduct (manager|owner|management)\b/i;
const DATA =
  /\b(data scientist|data analyst|data engineer|analytics engineer|machine learning|business intelligence)\b/i;
const DESIGN = /\b(designer|ux\s*\/\s*ui|ui\s*\/\s*ux)\b/i;
const SOFTWARE =
  /\b(java|aws|fullstack|full[\s-]stack|front[\s-]?end|back[\s-]?end|react|node\.?js|devops|\bsre\b|kubernetes|python|golang|\.net|android|\bios\b|software)\b/i;

export function professionOfText(text: string): Profession {
  const hay = text.replace(/[_/|]+/g, ' ');
  if (MAINFRAME.test(hay)) return 'mainframe';
  if (COMMERCIAL.test(hay)) return 'commercial';
  if (PRODUCT.test(hay)) return 'product';
  if (DATA.test(hay)) return 'data';
  if (DESIGN.test(hay)) return 'design';
  if (SOFTWARE.test(hay) || /\b(developer|engineer)\b/i.test(hay)) return 'software';
  return 'other';
}

export function candidateProfession(cv: ProfessionCv): Profession {
  const current = cv.roles?.find((role) => role.isCurrent) ?? cv.roles?.[0];
  const fromTitle = professionOfText(current?.title ?? '');
  if (fromTitle !== 'other') return fromTitle;
  const fromHints = professionOfText((cv.targetRoleHints ?? []).join(' '));
  if (fromHints !== 'other') return fromHints;
  return professionOfText((cv.skills ?? []).slice(0, 24).join(' '));
}

export function sameProfession(candidate: Profession, jobTitle: string): boolean {
  if (candidate === 'other') return false;
  return professionOfText(jobTitle) === candidate;
}

const POOL: Record<Exclude<Profession, 'other'>, { include: string[]; exclude: string[] }> = {
  mainframe: {
    include: ['cobol', 'mainframe', 'cics', 'rexx', 'jcl', 'db2', 'as400', 'as/400'],
    exclude: [
      'java',
      'aws',
      'fullstack',
      'full stack',
      'react',
      'node',
      'devops',
      'kubernetes',
      'category',
      'revenue',
      'product manager',
      'data scientist',
    ],
  },
  software: {
    include: [
      'developer',
      'engineer',
      'java',
      'aws',
      'react',
      'fullstack',
      'devops',
      'node',
      'python',
    ],
    exclude: ['cobol', 'mainframe', 'cics', 'rexx', 'category manager', 'revenue manager'],
  },
  data: {
    include: ['data scientist', 'data analyst', 'data engineer', 'analytics', 'machine learning'],
    exclude: ['cobol', 'mainframe', 'category manager', 'revenue manager'],
  },
  product: {
    include: ['product manager', 'product owner', 'product management'],
    exclude: ['cobol', 'mainframe', 'java developer', 'category manager'],
  },
  design: {
    include: ['designer', 'ux', 'ui/ux'],
    exclude: ['cobol', 'mainframe', 'java developer'],
  },
  commercial: {
    include: ['category', 'revenue', 'merchandis', 'pricing', 'gtm', 'demand planner'],
    exclude: ['cobol', 'mainframe', 'java', 'fullstack', 'developer', 'aws', 'devops'],
  },
};

export function professionPool(
  profession: Profession,
): { include: string[]; exclude: string[] } | null {
  if (profession === 'other') return null;
  return POOL[profession];
}
