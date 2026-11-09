import { describe, expect, it } from 'vitest';
import type { CvFacts } from '@firstround/contracts';
import { scoreCvReadiness } from '../src/readiness/scorer.js';

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

describe('scoreCvReadiness', () => {
  it('scores a strong CV into the ready or improve band', () => {
    const result = scoreCvReadiness(strong, ['product manager']);
    expect(result.total).toBeGreaterThanOrEqual(70);
    expect(result.sendability.ok).toBe(true);
    expect(result.algorithmVersion).toBe('readiness-v1');
  });

  it('keeps thin CVs limited and explains gaps in plain language', () => {
    const result = scoreCvReadiness(thin);
    expect(result.total).toBeLessThan(70);
    expect(result.band).toBe('limited');
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.sendability.ok).toBe(false);
  });

  it('penalizes overlapping full-time chronology, not career shape', () => {
    const result = scoreCvReadiness(messyDates);
    expect(result.dimensions.careerConsistency).toBeLessThan(100);
    expect(result.gaps.some((g) => /overlap|date/i.test(g))).toBe(true);
  });
});
