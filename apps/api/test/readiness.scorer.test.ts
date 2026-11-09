import { describe, expect, it } from 'vitest';
import type { CvFacts } from '@firstround/contracts';
import { scoreCvReadiness } from '../src/readiness/scorer.js';
import { normalizeLexicon, normalizeSkill, normalizeTitle } from '../src/readiness/taxonomy.js';

const strong: CvFacts = {
  emails: ['a@example.com'],
  phones: [],
  locations: ['Bengaluru'],
  links: { linkedin: 'https://linkedin.com/in/a', other: [] },
  skills: ['TypeScript', 'Product', 'SQL', 'Experimentation', 'Roadmaps'],
  roles: [
    {
      title: 'Senior Product Manager',
      company: 'Acme',
      startDate: '2021-01',
      endDate: null,
      isCurrent: true,
      bullets: [
        'Grew activation 18% in two quarters by redesigning onboarding.',
        'Led a 6-person squad shipping weekly experiments on checkout.',
      ],
      tools: ['Amplitude', 'SQL', 'Figma'],
      metrics: ['18% activation lift'],
      scope: 'Consumer checkout',
    },
    {
      title: 'Product Manager',
      company: 'Beta',
      startDate: '2018-06',
      endDate: '2020-12',
      isCurrent: false,
      bullets: ['Cut support tickets 22% by clarifying pricing pages.'],
      tools: ['Mixpanel'],
      metrics: ['22% ticket drop'],
    },
  ],
  education: [{ school: 'IIT', degree: 'B.Tech' }],
  targetRoleHints: ['product manager'],
};

const average: CvFacts = {
  emails: ['c@example.com'],
  phones: [],
  locations: ['Pune'],
  links: { linkedin: 'https://linkedin.com/in/c', other: [] },
  skills: ['Java', 'SQL'],
  roles: [
    {
      title: 'Software Engineer',
      company: 'Studio',
      startDate: '2022-03',
      endDate: null,
      isCurrent: true,
      bullets: [
        'Built APIs for the billing service.',
        'Worked on dashboard improvements with the product team.',
      ],
      tools: ['Java'],
      metrics: [],
    },
  ],
  education: [{ school: 'State Uni', degree: 'B.E.' }],
  targetRoleHints: ['software engineer'],
};

const thin: CvFacts = {
  emails: [],
  phones: [],
  locations: [],
  links: { other: [] },
  skills: [],
  roles: [
    {
      title: 'Associate',
      company: 'Co',
      startDate: null,
      endDate: null,
      isCurrent: false,
      bullets: ['Responsible for various tasks'],
      tools: [],
      metrics: [],
    },
  ],
  education: [],
  targetRoleHints: [],
};

const messyDates: CvFacts = {
  emails: ['b@example.com'],
  phones: [],
  locations: ['Mumbai'],
  links: { other: [] },
  skills: ['Java'],
  roles: [
    {
      title: 'Engineer',
      company: 'One',
      startDate: '2020-01',
      endDate: '2022-01',
      isCurrent: false,
      bullets: ['Built APIs for payments at scale for 2m users.'],
      tools: ['Java'],
      metrics: ['2m users'],
    },
    {
      title: 'Engineer',
      company: 'Two',
      startDate: '2021-01',
      endDate: '2023-01',
      isCurrent: false,
      bullets: ['Owned ledger services.'],
      tools: ['Java'],
      metrics: [],
    },
  ],
  education: [],
  targetRoleHints: ['engineer'],
};

describe('scoreCvReadiness v2', () => {
  it('scores a strong CV into ready (≥80)', () => {
    const result = scoreCvReadiness(strong, ['product manager']);
    expect(result.total).toBeGreaterThanOrEqual(80);
    expect(result.band).toBe('ready');
    expect(result.recommendation.action).toBe('continue');
    expect(result.sendability.ok).toBe(true);
    expect(result.algorithmVersion).toBe('readiness-v2');
  });

  it('keeps ordinary CVs in supercharge (60–79), not failure', () => {
    const result = scoreCvReadiness(average, ['software engineer']);
    expect(result.total).toBeGreaterThanOrEqual(60);
    expect(result.total).toBeLessThan(80);
    expect(result.band).toBe('supercharge');
    expect(result.recommendation.action).toBe('supercharge');
  });

  it('coaches thin CVs without crushing them into single digits', () => {
    const result = scoreCvReadiness(thin);
    expect(result.total).toBeGreaterThanOrEqual(40);
    expect(result.total).toBeLessThan(60);
    expect(result.band).toBe('strengthen');
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.sendability.ok).toBe(false);
  });

  it('penalizes overlapping full-time chronology, not career shape', () => {
    const result = scoreCvReadiness(messyDates);
    expect(result.dimensions.careerConsistency).toBeLessThan(100);
    expect(result.genuineGaps.some((g) => /overlap|date/i.test(g))).toBe(true);
  });

  it('returns checks, confidence, and normalized lexicon', () => {
    const result = scoreCvReadiness(strong, ['product manager']);
    expect(result.checks.length).toBeGreaterThan(3);
    expect(result.confidence.overall).toBeGreaterThan(0.4);
    expect(result.normalized.skills).toContain('typescript');
    expect(result.normalized.titles).toContain('senior product manager');
  });
});

describe('taxonomy', () => {
  it('normalizes skill and title aliases', () => {
    expect(normalizeSkill('React.js')).toBe('react');
    expect(normalizeTitle('Sr. Product Manager')).toBe('senior product manager');
    const lex = normalizeLexicon({
      skills: ['TS', 'Node JS'],
      titles: ['SWE'],
      hints: ['software engineer'],
    });
    expect(lex.skills).toEqual(expect.arrayContaining(['typescript', 'node.js']));
    expect(lex.titles).toContain('software engineer');
    expect(lex.families).toContain('engineering');
  });
});
