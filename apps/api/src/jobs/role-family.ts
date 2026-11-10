/** Role family for desk match. Current role + target hints decide. Education and older titles do not. */

export type RoleFamily = 'commercial' | 'software' | 'data' | 'product' | 'design' | 'other';

export type FamilyRole = {
  title: string;
  isCurrent?: boolean;
};

export type FamilyCv = {
  targetRoleHints?: string[];
  roles?: FamilyRole[];
};

const COMMERCIAL =
  /\b(category|revenue|merchandis\w*|demand|pricing|assortment|gtm|go[\s-]?to[\s-]?market|commercial|p\s*&\s*l|p and l|e-?commerce|retail|buyer)\b/i;
const PRODUCT = /\b(product manager|product owner|product management)\b/i;
const DATA = /\b(data scientist|data analyst|analytics engineer|business intelligence|\bbi\b)\b/i;
const SOFTWARE =
  /\b(software|developer|devops|sre|fullstack|full[\s-]stack|front[\s-]?end|back[\s-]?end|java|react|node\.?js|android|\bios\b|sdet|\bqa\b|machine learning|ml engineer)\b/i;
const DESIGN = /\b(designer|\bux\b|\bui\b)\b/i;

export function familyOfText(text: string): RoleFamily {
  const hay = text.replace(/[_/|]+/g, ' ');
  if (COMMERCIAL.test(hay)) return 'commercial';
  if (PRODUCT.test(hay) && !SOFTWARE.test(hay)) return 'product';
  if (DATA.test(hay)) return 'data';
  if (SOFTWARE.test(hay) || /\bengineer\b/i.test(hay)) return 'software';
  if (DESIGN.test(hay)) return 'design';
  return 'other';
}

/** Latest/current role wins. Hints fill in only when that role has no family. */
export function primaryFamily(cv: FamilyCv): RoleFamily {
  const current = cv.roles?.find((r) => r.isCurrent) ?? cv.roles?.[0];
  const fromCurrent = current ? familyOfText(current.title) : 'other';
  if (fromCurrent !== 'other') return fromCurrent;
  const fromHints = familyOfText((cv.targetRoleHints ?? []).join(' '));
  return fromHints;
}

export function titleConstraints(
  family: RoleFamily,
): { include: string[]; exclude: string[] } | null {
  if (family === 'commercial') {
    return {
      include: [
        'category',
        'revenue',
        'merchandis',
        'demand',
        'pricing',
        'assortment',
        'gtm',
        'commercial',
        'retail',
        'buyer',
        'e-commerce',
        'ecommerce',
      ],
      exclude: [
        'developer',
        'software',
        'devops',
        'java',
        'react',
        'android',
        'ios',
        'frontend',
        'backend',
        'fullstack',
        'full stack',
        'machine learning',
        'data scientist',
        'data analyst',
        'sdet',
      ],
    };
  }
  if (family === 'software') {
    return {
      include: [
        'developer',
        'software',
        'engineer',
        'devops',
        'sre',
        'frontend',
        'backend',
        'fullstack',
        'java',
        'react',
        'android',
        'ios',
      ],
      exclude: ['category manager', 'revenue manager', 'merchandis'],
    };
  }
  if (family === 'data') {
    return {
      include: ['data', 'analyst', 'analytics', 'machine learning', 'scientist'],
      exclude: ['category manager', 'revenue manager'],
    };
  }
  if (family === 'product') {
    return {
      include: ['product manager', 'product owner', 'product management'],
      exclude: ['developer', 'software engineer'],
    };
  }
  if (family === 'design') {
    return {
      include: ['designer', 'ux', 'ui '],
      exclude: ['developer', 'backend'],
    };
  }
  return null;
}
