import { describe, expect, it, vi } from 'vitest';
import type { CvFacts } from '@firstround/contracts';
import { scoreCvReadiness } from '../src/readiness/scorer.js';
import { SUPERCHARGE_MODEL, superchargeCvWithGrok } from '../src/cv/grok-supercharge.js';

const facts: CvFacts = {
  emails: ['a@example.com'],
  phones: [],
  locations: ['Pune'],
  links: { other: [] },
  skills: ['Java', 'SQL'],
  roles: [
    {
      title: 'Software Engineer',
      company: 'Studio',
      startDate: '2022-03',
      endDate: null,
      isCurrent: true,
      bullets: ['Built APIs for the billing service used by 2m customers.'],
      tools: ['Java'],
      metrics: ['2m customers'],
    },
  ],
  education: [],
  targetRoleHints: ['software engineer'],
};

describe('superchargeCvWithGrok', () => {
  it('calls grok-4.7 and coerces numeric metrics before parse', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              facts: {
                ...facts,
                roles: [
                  {
                    ...facts.roles[0],
                    metrics: [2],
                    startDate: 2022,
                  },
                ],
              },
              rewrittenText:
                'Software Engineer at Studio. Built APIs for the billing service used by 2m customers.',
            }),
          },
        },
      ],
    });
    const client = { chat: { completions: { create } } };
    const readiness = scoreCvReadiness(facts, ['software engineer']);
    const result = await superchargeCvWithGrok({
      client: client as never,
      facts,
      readiness,
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: SUPERCHARGE_MODEL }));
    expect(result.modelVersion).toBe('grok-4.7');
    expect(result.facts.roles[0]?.metrics).toEqual(['2']);
    expect(result.facts.roles[0]?.startDate).toBe('2022');
  });
});
