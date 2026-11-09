import { describe, expect, it } from 'vitest';
import type { CvFacts } from '@firstround/contracts';
import { scoreCvReadiness } from '../src/readiness/scorer.js';
import { finalizeSupercharge } from '../src/cv/supercharge-facts.js';

const original: CvFacts = {
  fullName: 'Asha Rao',
  emails: ['asha@example.com'],
  phones: [],
  locations: ['Bengaluru'],
  links: { linkedin: 'https://linkedin.com/in/asha', other: [] },
  summary:
    'Product manager who ships onboarding and checkout experiments with the data already on this CV.',
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
  education: [{ school: 'IIT', degree: 'B.Tech', endDate: '2018' }],
  targetRoleHints: ['product manager'],
};

const damaged: CvFacts = {
  ...original,
  emails: [],
  locations: [],
  links: { other: [] },
  summary: 'Raised revenue 99% at a company that was not on the CV.',
  skills: ['Golf'],
  roles: [
    {
      title: 'Senior Product Manager',
      company: 'Acme',
      startDate: '2019-01',
      endDate: '2020-01',
      isCurrent: false,
      bullets: ['Did stuff.', 'Raised revenue 99%.'],
      tools: [],
      metrics: ['99% revenue'],
    },
  ],
  education: [],
  targetRoleHints: [],
};

describe('finalizeSupercharge', () => {
  it('refuses a rewrite that would drop a stored 75', () => {
    const prior = scoreCvReadiness(original, ['product']);
    prior.total = 75;
    const result = finalizeSupercharge({
      original,
      proposed: damaged,
      prior,
      targetHints: ['product'],
    });

    expect(result.readiness.total).toBeGreaterThanOrEqual(75);
    expect(result.acceptedRewrite).toBe(false);
    expect(JSON.stringify(result.facts)).not.toMatch(/99/);
    expect(result.facts.emails).toEqual(['asha@example.com']);
    expect(result.facts.roles[0]?.startDate).toBe('2021-01');
    expect(result.facts.roles[0]?.isCurrent).toBe(true);
    expect(result.facts.roles[0]?.metrics?.join(' ')).toMatch(/18%/);
    expect(result.facts.roles[1]?.metrics?.join(' ')).toMatch(/22%/);
    expect(result.facts.education).toHaveLength(1);
    expect(result.facts.roles).toHaveLength(2);
  });

  it('holds the stored total even when a rescore of the same facts would land lower', () => {
    const prior = scoreCvReadiness(original, ['product']);
    const stored = { ...prior, total: 96 };
    const result = finalizeSupercharge({
      original,
      proposed: damaged,
      prior: stored,
      targetHints: ['product'],
    });
    expect(result.readiness.total).toBeGreaterThanOrEqual(96);
    expect(result.readiness.band).toBe('ready');
  });

  it('accepts a grounded rewrite that keeps every number and does not lower the score', () => {
    const prior = scoreCvReadiness(original, ['product manager']);
    const proposed: CvFacts = {
      ...original,
      roles: [
        {
          ...original.roles[0]!,
          bullets: [
            'Grew activation 18% in two quarters by redesigning onboarding for first-time buyers.',
            'Led a 6-person squad that shipped weekly checkout experiments and owned the roadmap.',
          ],
        },
        {
          ...original.roles[1]!,
          bullets: [
            'Cut support tickets 22% by clarifying pricing pages for the self-serve billing flow.',
          ],
        },
      ],
    };
    const result = finalizeSupercharge({
      original,
      proposed,
      prior,
      targetHints: ['product manager'],
    });
    expect(result.readiness.total).toBeGreaterThanOrEqual(prior.total);
    expect(result.acceptedRewrite).toBe(true);
    expect(result.facts.roles[0]?.bullets[0]).toMatch(/18%/);
    expect(result.facts.roles[0]?.bullets[1]).toMatch(/\b6\b/);
    expect(result.facts.roles[1]?.bullets[0]).toMatch(/22%/);
    expect(result.facts.roles[0]?.startDate).toBe('2021-01');
  });
});
