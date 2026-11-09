import { describe, expect, it } from 'vitest';
import { CvFacts } from '@firstround/contracts';
import { coerceCvFactsPayload } from '../src/cv/coerce-cv-facts.js';

describe('coerceCvFactsPayload', () => {
  it('stringifies numeric metrics and dates so CvFacts.parse succeeds', () => {
    const coerced = coerceCvFactsPayload({
      emails: ['a@example.com'],
      phones: [9876543210],
      skills: ['TypeScript', 12],
      roles: [
        {
          title: 'PM',
          company: 'Acme',
          startDate: 2021,
          endDate: null,
          isCurrent: true,
          bullets: ['Grew activation 18%'],
          tools: ['SQL'],
          metrics: [18, '22% ticket drop'],
        },
      ],
      education: [{ school: 'IIT', degree: 'B.Tech', endDate: 2018 }],
      targetRoleHints: ['product'],
    });

    const facts = CvFacts.parse(coerced);
    expect(facts.phones).toEqual(['9876543210']);
    expect(facts.skills).toEqual(['TypeScript', '12']);
    expect(facts.roles[0]?.startDate).toBe('2021');
    expect(facts.roles[0]?.metrics).toEqual(['18', '22% ticket drop']);
    expect(facts.education[0]?.endDate).toBe('2018');
  });
});
