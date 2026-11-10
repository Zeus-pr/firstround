/**
 * Role family for desk match.
 * Current role, then hints, then skills. Education is ignored.
 * Explicit preference families are added — they never replace the CV, they widen it.
 */

export type RoleFamily = 'commercial' | 'software' | 'data' | 'product' | 'design' | 'other';

export type FamilyRole = {
  title: string;
  isCurrent?: boolean;
};

export type FamilyCv = {
  targetRoleHints?: string[];
  roles?: FamilyRole[];
  skills?: string[];
};

type Weighted = { family: Exclude<RoleFamily, 'other'>; re: RegExp; weight: number };

/** Higher weight wins. Strong role nouns beat weak context words like "retail" or "e-commerce". */
const RULES: Weighted[] = [
  {
    family: 'product',
    re: /\bproduct (manager|owner|management)\b/i,
    weight: 6,
  },
  {
    family: 'data',
    re: /\b(data scientist|data analyst|data engineer|analytics engineer|machine learning engineer|ml engineer|business intelligence)\b/i,
    weight: 6,
  },
  {
    family: 'design',
    re: /\b(ux designer|ui designer|product designer|graphic designer|visual designer|ux\s*\/\s*ui|ui\s*\/\s*ux)\b/i,
    weight: 6,
  },
  {
    family: 'software',
    re: /\b(software engineer|software developer|developer|devops|site reliability|fullstack|full[\s-]stack|front[\s-]?end|back[\s-]?end|java(?:script)?|react(?:\.?js)?|node\.?js|android|\bios\b|sdet|qa engineer|quality assurance|engineering manager|dot\s*net|\.net|golang|kotlin|swift)\b/i,
    weight: 6,
  },
  {
    family: 'commercial',
    re: /\b(category|merchandis\w*|revenue|pricing|assortment|\bgtm\b|go[\s-]?to[\s-]?market|buyer|p\s*&\s*l|p and l)\b/i,
    weight: 6,
  },
  {
    family: 'data',
    re: /\b(machine learning|tableau|power\s*bi|looker|analytics)\b/i,
    weight: 4,
  },
  {
    family: 'design',
    re: /\b(designer|\bux\b|\bui\b)\b/i,
    weight: 4,
  },
  {
    family: 'software',
    re: /\b(software|sre)\b/i,
    weight: 4,
  },
  {
    family: 'commercial',
    re: /\b(e-?commerce|retail|demand planning|commercial manager|commercial lead|commercial head)\b/i,
    weight: 2,
  },
];

const NON_SOFTWARE_ENGINEER =
  /\b(civil|mechanical|electrical|chemical|structural|fiber|fibre|site|sales)\s+engineers?\b/i;

function haystack(text: string): string {
  return text.replace(/[_/|]+/g, ' ');
}

function bestFamily(text: string): { family: RoleFamily; weight: number } {
  const hay = haystack(text);
  if (!hay.trim()) return { family: 'other', weight: 0 };
  let best: { family: RoleFamily; weight: number } = { family: 'other', weight: 0 };
  for (const rule of RULES) {
    if (rule.weight > best.weight && rule.re.test(hay)) {
      best = { family: rule.family, weight: rule.weight };
    }
  }
  if (best.family === 'other' && /\bengineers?\b/i.test(hay) && !NON_SOFTWARE_ENGINEER.test(hay)) {
    return { family: 'software', weight: 3 };
  }
  if (best.family === 'software' && NON_SOFTWARE_ENGINEER.test(hay) && best.weight < 6) {
    return { family: 'other', weight: 0 };
  }
  return best;
}

export function familyOfText(text: string): RoleFamily {
  return bestFamily(text).family;
}

const PREFERENCE_ALIASES: Array<[RegExp, string]> = [
  [/^(product|pm)$/i, 'product manager'],
  [/^(software|swe|backend|frontend|fullstack|full stack|engineering)$/i, 'software engineer'],
  [/^(data|analytics|ml)$/i, 'data analyst'],
  [/^(design|ux|ui)$/i, 'ux designer'],
  [/^(category|revenue|gtm|retail|merchandising|commercial)$/i, 'category manager'],
];

export function familyOfPreference(token: string): RoleFamily {
  const trimmed = token.trim();
  const alias = PREFERENCE_ALIASES.find(([re]) => re.test(trimmed));
  return familyOfText(alias ? alias[1] : trimmed);
}

function currentRole(cv: FamilyCv): FamilyRole | undefined {
  return cv.roles?.find((r) => r.isCurrent) ?? cv.roles?.[0];
}

/**
 * CV family. A weak title ("E-commerce Intern") does not override a stronger hint
 * ("Full Stack Developer"). Skills are the last resort.
 */
export function primaryFamily(cv: FamilyCv): RoleFamily {
  const current = currentRole(cv);
  const fromCurrent = current ? bestFamily(current.title) : { family: 'other' as const, weight: 0 };
  const fromHints = bestFamily((cv.targetRoleHints ?? []).join(' '));
  if (fromHints.weight > fromCurrent.weight && fromHints.family !== 'other') {
    return fromHints.family;
  }
  if (fromCurrent.family !== 'other') return fromCurrent.family;
  if (fromHints.family !== 'other') return fromHints.family;
  return bestFamily((cv.skills ?? []).slice(0, 12).join(' ')).family;
}

const TITLE_STOP = new Set([
  'senior',
  'junior',
  'manager',
  'executive',
  'assistant',
  'lead',
  'head',
  'specialist',
  'associate',
  'officer',
  'intern',
  'with',
  'from',
  'role',
  'hiring',
  'walk',
  'incharge',
]);

/**
 * When no profession family is known, search the words of the current title
 * instead of the whole corpus. Stops an HR or sales CV landing in software jobs.
 */
export function otherNeedles(cv: FamilyCv): string[] {
  const current = currentRole(cv);
  const text = haystack(`${current?.title ?? ''} ${(cv.targetRoleHints ?? []).join(' ')}`);
  const needles = new Set<string>();
  for (const raw of text.split(/[^a-z0-9+#.]+/i)) {
    const word = raw.trim().toLowerCase();
    if (!word || TITLE_STOP.has(word)) continue;
    if (word.length < 3 && !['hr', 'pr', 'mis', 'sap'].includes(word)) continue;
    needles.add(word);
    if (needles.size >= 8) break;
  }
  return [...needles];
}

/** CV family plus any explicit preference families. Empty preferences do not widen or narrow. */
export function allowedFamilies(cv: FamilyCv, preferenceFamilies: string[] = []): RoleFamily[] {
  const found = new Set<RoleFamily>();
  const primary = primaryFamily(cv);
  if (primary !== 'other') found.add(primary);
  for (const token of preferenceFamilies) {
    const family = familyOfPreference(token);
    if (family !== 'other') found.add(family);
  }
  return [...found];
}

const POOL: Record<Exclude<RoleFamily, 'other'>, { include: string[]; exclude: string[] }> = {
  commercial: {
    include: [
      'category',
      'revenue',
      'merchandis',
      'pricing',
      'assortment',
      'gtm',
      'buyer',
      'e-commerce',
      'ecommerce',
      'demand planning',
    ],
    exclude: [
      'developer',
      'software',
      'devops',
      'java',
      'react',
      'android',
      'frontend',
      'backend',
      'fullstack',
      'full stack',
      'data scientist',
      'data analyst',
      'data engineer',
      'sdet',
    ],
  },
  software: {
    include: [
      'developer',
      'software',
      'devops',
      'sre',
      'frontend',
      'backend',
      'fullstack',
      'full stack',
      'java',
      'react',
      'android',
      'ios',
      'node',
      'golang',
      'dot net',
      '.net',
      'engineering manager',
      'sdet',
      'qa',
    ],
    exclude: [
      'category manager',
      'revenue manager',
      'merchandis',
      'civil',
      'mechanical',
      'electrical',
      'chemical',
      'fiber',
      'fibre',
      'structural',
    ],
  },
  data: {
    include: [
      'data scientist',
      'data analyst',
      'data engineer',
      'analytics',
      'machine learning',
      'business intelligence',
    ],
    exclude: ['category manager', 'revenue manager', 'merchandis', 'data entry'],
  },
  product: {
    include: ['product manager', 'product owner', 'product management'],
    exclude: ['developer', 'software engineer'],
  },
  design: {
    include: ['designer', 'ux', 'ui/ux', 'ui / ux'],
    exclude: ['developer', 'backend', 'luxury'],
  },
};

export function titleConstraints(
  family: RoleFamily,
): { include: string[]; exclude: string[] } | null {
  if (family === 'other') return null;
  return POOL[family];
}

/** Union of includes. A title is excluded only when every selected family excludes it. */
export function poolConstraints(
  families: RoleFamily[],
): { include: string[]; exclude: string[] } | null {
  const specs = families
    .map((family) => titleConstraints(family))
    .filter((spec): spec is { include: string[]; exclude: string[] } => spec != null);
  if (specs.length === 0) return null;
  const include = [...new Set(specs.flatMap((spec) => spec.include))];
  const exclude = specs[0]!.exclude.filter((needle) =>
    specs.every((spec) => spec.exclude.includes(needle)),
  );
  return { include, exclude };
}
