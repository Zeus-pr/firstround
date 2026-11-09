import { TAXONOMY_VERSION } from '@firstround/contracts';

/** First Round controlled lexicon. Aliases collapse to canonical tokens. */
const SKILL_ALIASES: Record<string, string> = {
  js: 'javascript',
  'java script': 'javascript',
  ts: 'typescript',
  'type script': 'typescript',
  reactjs: 'react',
  'react.js': 'react',
  nextjs: 'next.js',
  'next js': 'next.js',
  nodejs: 'node.js',
  'node js': 'node.js',
  golang: 'go',
  k8s: 'kubernetes',
  postgres: 'postgresql',
  psql: 'postgresql',
  'amazon web services': 'aws',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  'ms excel': 'excel',
  'microsoft excel': 'excel',
  'power bi': 'powerbi',
  lookerstudio: 'looker',
  'data studio': 'looker',
  'machine learning': 'ml',
  'artificial intelligence': 'ai',
  llm: 'llms',
  'large language models': 'llms',
  'product management': 'product',
  'project management': 'project management',
  jira: 'jira',
  figma: 'figma',
  sql: 'sql',
  python: 'python',
  java: 'java',
  rust: 'rust',
  docker: 'docker',
  kubernetes: 'kubernetes',
  aws: 'aws',
  gcp: 'gcp',
  azure: 'azure',
  tableau: 'tableau',
  looker: 'looker',
  amplitude: 'amplitude',
  mixpanel: 'mixpanel',
  salesforce: 'salesforce',
  excel: 'excel',
};

const TITLE_ALIASES: Record<string, string> = {
  'sr product manager': 'senior product manager',
  'sr. product manager': 'senior product manager',
  'product mgr': 'product manager',
  pm: 'product manager',
  'senior pm': 'senior product manager',
  'staff pm': 'staff product manager',
  'eng manager': 'engineering manager',
  'software eng': 'software engineer',
  swe: 'software engineer',
  sde: 'software engineer',
  'frontend engineer': 'front end engineer',
  'front-end engineer': 'front end engineer',
  'backend engineer': 'back end engineer',
  'back-end engineer': 'back end engineer',
  'full-stack engineer': 'full stack engineer',
  'fullstack engineer': 'full stack engineer',
  'data scientist': 'data scientist',
  'ml engineer': 'machine learning engineer',
  'ai engineer': 'machine learning engineer',
  'ux designer': 'product designer',
  'ui designer': 'product designer',
  'growth pm': 'growth product manager',
};

const FAMILY_BY_TITLE: Record<string, string> = {
  'product manager': 'product',
  'senior product manager': 'product',
  'staff product manager': 'product',
  'growth product manager': 'product',
  'software engineer': 'engineering',
  'front end engineer': 'engineering',
  'back end engineer': 'engineering',
  'full stack engineer': 'engineering',
  'engineering manager': 'engineering',
  'data scientist': 'data',
  'data analyst': 'data',
  'machine learning engineer': 'data',
  'product designer': 'design',
  'product analyst': 'analytics',
  'growth analyst': 'analytics',
};

const FAMILY_SKILLS: Record<string, string[]> = {
  product: ['product', 'roadmap', 'experimentation', 'sql', 'figma', 'amplitude', 'mixpanel'],
  engineering: [
    'typescript',
    'javascript',
    'python',
    'java',
    'go',
    'react',
    'node.js',
    'sql',
    'aws',
  ],
  data: ['python', 'sql', 'ml', 'llms', 'tableau', 'looker', 'aws'],
  analytics: ['sql', 'excel', 'amplitude', 'mixpanel', 'tableau', 'looker', 'experimentation'],
  design: ['figma', 'product', 'research'],
};

function clean(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.+#\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSkill(raw: string): string {
  const key = clean(raw);
  if (!key) return '';
  return SKILL_ALIASES[key] ?? key;
}

export function normalizeTitle(raw: string): string {
  const key = clean(raw);
  if (!key) return '';
  return TITLE_ALIASES[key] ?? key;
}

export function familyForTitle(title: string): string | null {
  const n = normalizeTitle(title);
  return FAMILY_BY_TITLE[n] ?? null;
}

export function skillsForFamily(family: string): string[] {
  return FAMILY_SKILLS[family] ?? [];
}

export function normalizeLexicon(input: { skills: string[]; titles: string[]; hints?: string[] }): {
  taxonomyVersion: typeof TAXONOMY_VERSION;
  skills: string[];
  titles: string[];
  families: string[];
} {
  const skills = [...new Set(input.skills.map(normalizeSkill).filter(Boolean))].slice(0, 80);
  const titles = [
    ...new Set([...input.titles, ...(input.hints ?? [])].map(normalizeTitle).filter(Boolean)),
  ].slice(0, 40);
  const families = [
    ...new Set(titles.map(familyForTitle).filter((f): f is string => Boolean(f))),
  ].slice(0, 20);
  return { taxonomyVersion: TAXONOMY_VERSION, skills, titles, families };
}

export function taxonomyCoverage(normalizedSkills: string[], families: string[]): number {
  if (families.length === 0) return 0.55;
  let hits = 0;
  let need = 0;
  for (const family of families) {
    const expected = skillsForFamily(family);
    need += expected.length;
    for (const skill of expected) {
      if (normalizedSkills.includes(skill)) hits += 1;
    }
  }
  if (need === 0) return 0.55;
  return hits / need;
}
