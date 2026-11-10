import { describe, expect, it } from 'vitest';
import { EMPTY_PREFERENCES_CRITERIA } from '@firstround/contracts';
import { rankMatches, scoreJobMatch, type MatchableJob } from '../src/jobs/match.js';

const job = (over: Partial<MatchableJob> = {}): MatchableJob => ({
  id: 'j1',
  title: 'Assistant Manager — Category & Revenue Management',
  companyName: 'Acme Retail',
  location: 'Kolkata',
  workMode: 'onsite',
  employmentType: 'full-time',
  seniority: 'mid',
  descriptionText: 'Own P&L, GTM strategy, revenue growth for consumer electronics in East India.',
  skills: ['P&L', 'Revenue', 'GTM'],
  trustScore: 82,
  sourceUrl: 'https://www.naukri.com/job/1',
  invitedEmail: null,
  ...over,
});

const emptyPrefs = {
  jobFamilies: [] as string[],
  locations: [] as string[],
  targetLevel: null as string | null,
  links: {},
  criteria: EMPTY_PREFERENCES_CRITERIA,
};

describe('desk job match', () => {
  it('scores family and location hits higher', () => {
    const hit = scoreJobMatch(
      {
        ...emptyPrefs,
        jobFamilies: ['revenue', 'category'],
        locations: ['Kolkata', 'East India'],
        targetLevel: 'mid',
      },
      job(),
    );
    const miss = scoreJobMatch(
      {
        ...emptyPrefs,
        jobFamilies: ['backend engineer', 'golang'],
        locations: ['Bengaluru'],
        targetLevel: 'senior',
      },
      job(),
    );
    expect(hit.matchScore).toBeGreaterThan(miss.matchScore);
    expect(hit.matchScore).toBeGreaterThanOrEqual(48);
  });

  it('keeps empty preferences from zeroing the desk', () => {
    const result = scoreJobMatch(emptyPrefs, job());
    expect(result.matchScore).toBeGreaterThanOrEqual(48);
  });

  it('boosts desired companies without excluding others', () => {
    const desired = scoreJobMatch(
      {
        ...emptyPrefs,
        criteria: { ...EMPTY_PREFERENCES_CRITERIA, desiredCompanies: ['Acme'] },
      },
      job(),
    );
    const other = scoreJobMatch(
      {
        ...emptyPrefs,
        criteria: { ...EMPTY_PREFERENCES_CRITERIA, desiredCompanies: ['Flipkart'] },
      },
      job(),
    );
    expect(desired.matchScore).toBeGreaterThan(other.matchScore);
    expect(other.matchScore).toBeGreaterThanOrEqual(40);
  });

  it('ranks and caps results', () => {
    const ranked = rankMatches(
      { ...emptyPrefs, jobFamilies: ['revenue'], locations: ['India'] },
      [
        job({ id: 'a', title: 'Revenue Strategy Manager', location: 'Mumbai' }),
        job({ id: 'b', title: 'Java Developer', location: 'Pune', trustScore: 90 }),
        job({ id: 'c', title: 'Category Manager', location: 'Delhi' }),
      ],
      { minMatch: 40, limit: 2 },
    );
    expect(ranked.length).toBeLessThanOrEqual(2);
    expect(ranked[0]!.matchScore).toBeGreaterThanOrEqual(ranked.at(-1)!.matchScore);
  });
});
