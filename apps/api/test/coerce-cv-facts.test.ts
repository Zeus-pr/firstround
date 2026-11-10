import { describe, expect, it } from 'vitest';
import { CvFacts } from '@firstround/contracts';
import { coerceCvFactsPayload, coerceHttpUrl } from '../src/cv/coerce-cv-facts.js';

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

  it('normalizes scheme-less LinkedIn and drops junk links (phone analyze 500)', () => {
    const coerced = coerceCvFactsPayload({
      emails: ['not-an-email', 'ok@example.com'],
      links: {
        linkedin: 'linkedin.com/in/asha-rao',
        github: 'www.github.com/asha',
        portfolio: 'not a url',
        other: ['behance.net/asha', ''],
      },
      roles: [
        {
          title: 'PM',
          company: '',
          startDate: null,
          endDate: null,
          isCurrent: false,
          bullets: [],
          tools: [],
          metrics: [],
        },
        {
          title: '',
          company: 'Drop me',
          startDate: null,
          endDate: null,
          isCurrent: false,
          bullets: [],
          tools: [],
          metrics: [],
        },
      ],
      education: [{ school: '', degree: 'B.Tech' }],
    });

    const facts = CvFacts.parse(coerced);
    expect(facts.emails).toEqual(['ok@example.com']);
    expect(facts.links.linkedin).toBe('https://linkedin.com/in/asha-rao');
    expect(facts.links.github).toBe('https://www.github.com/asha');
    expect(facts.links.portfolio).toBeNull();
    expect(facts.links.other).toEqual(['https://behance.net/asha']);
    expect(facts.roles).toHaveLength(1);
    expect(facts.roles[0]?.company).toBeNull();
    expect(facts.education).toEqual([]);
  });
});

describe('coerceHttpUrl', () => {
  it('returns null for empty and invalid values', () => {
    expect(coerceHttpUrl('')).toBeNull();
    expect(coerceHttpUrl('linkedin')).toBeNull();
    expect(coerceHttpUrl(null)).toBeNull();
  });
});
