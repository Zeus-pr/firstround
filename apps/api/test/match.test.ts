import { describe, expect, it } from 'vitest';
import { rankMatches, scoreJobMatch, type MatchableJob } from '../src/jobs/match.js';

const job = (over: Partial<MatchableJob> = {}): MatchableJob => ({
  id: 'j1',
  title: 'Assistant Manager — Category & Revenue Management',
  companyName: 'Acme Retail',
  location: 'Kolkata',
  workMode: 'onsite',
  seniority: 'mid',
  descriptionText: 'Own P&L, GTM strategy, revenue growth for consumer electronics in East India.',
  skills: ['P&L', 'Revenue', 'GTM'],
  trustScore: 82,
  sourceUrl: 'https://www.naukri.com/job/1',
  invitedEmail: null,
  ...over,
});

describe('desk job match', () => {
  it('scores family and location hits higher', () => {
    const hit = scoreJobMatch(
      {
        jobFamilies: ['revenue', 'category'],
        locations: ['Kolkata', 'East India'],
        targetLevel: 'mid',
        links: {},
      },
      job(),
    );
    const miss = scoreJobMatch(
      {
        jobFamilies: ['backend engineer', 'golang'],
        locations: ['Bengaluru'],
        targetLevel: 'senior',
        links: {},
      },
      job(),
    );
    expect(hit.matchScore).toBeGreaterThan(miss.matchScore);
    expect(hit.matchScore).toBeGreaterThanOrEqual(55);
  });

  it('ranks and caps results', () => {
    const ranked = rankMatches(
      { jobFamilies: ['revenue'], locations: ['India'], targetLevel: null, links: {} },
      [
        job({ id: 'a', title: 'Revenue Strategy Manager', location: 'Mumbai' }),
        job({ id: 'b', title: 'Java Developer', location: 'Pune', trustScore: 90 }),
        job({ id: 'c', title: 'Category Manager', location: 'Delhi' }),
      ],
      { minMatch: 50, limit: 2 },
    );
    expect(ranked.length).toBeLessThanOrEqual(2);
    expect(ranked[0]!.matchScore).toBeGreaterThanOrEqual(ranked.at(-1)!.matchScore);
  });
});
