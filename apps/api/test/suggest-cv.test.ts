import { describe, expect, it, vi } from 'vitest';
import type { CvFacts, ReadinessResult } from '@firstround/contracts';
import { scoreCvReadiness } from '../src/readiness/scorer.js';
import {
  SUGGESTIONS_MODEL,
  algorithmSuggestions,
  groundSuggestions,
  suggestCvLines,
} from '../src/cv/suggest-cv.js';

const facts: CvFacts = {
  emails: ['a@example.com'],
  phones: [],
  locations: ['Bengaluru'],
  links: { other: [] },
  skills: ['SQL'],
  roles: [
    {
      title: 'Product Manager',
      company: 'Acme',
      startDate: '2021-01',
      endDate: null,
      isCurrent: true,
      bullets: ['Grew activation 18% by redesigning onboarding.'],
      tools: ['SQL'],
      metrics: ['18% activation lift'],
    },
  ],
  education: [],
  targetRoleHints: ['product'],
};

describe('suggestCvLines', () => {
  it('asks the non-reasoning model for short lines and drops invented numbers', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              suggestions: [
                'Move the 18% activation result to the first line of the Acme role.',
                'Claim a 99% revenue jump that is not on this CV.',
                'Add a city so role matches stay realistic.',
              ],
            }),
          },
        },
      ],
    });
    const readiness = scoreCvReadiness(facts, ['product']);
    const result = await suggestCvLines({
      client: { chat: { completions: { create } } } as never,
      facts,
      readiness,
      timeoutMs: 5_000,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: SUGGESTIONS_MODEL, max_tokens: 400 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.suggestions).toEqual([
      'Move the 18% activation result to the first line of the Acme role.',
      'Add a city so role matches stay realistic.',
    ]);
    expect(result.suggestions.join(' ')).not.toMatch(/99/);
  });

  it('stops waiting when the model does not answer in time', async () => {
    const create = vi.fn().mockImplementation((_body: unknown, opts: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const readiness = scoreCvReadiness(facts, []);
    await expect(
      suggestCvLines({
        client: { chat: { completions: { create } } } as never,
        facts,
        readiness,
        timeoutMs: 30,
      }),
    ).rejects.toThrow(/aborted/);
  });
});

describe('algorithm suggestions', () => {
  it('uses the score gaps and refuses a number the CV does not contain', () => {
    const readiness = scoreCvReadiness(facts, ['product']) as ReadinessResult;
    expect(algorithmSuggestions(readiness).length).toBeGreaterThan(0);
    expect(groundSuggestions(['Invent a 40% lift.'], facts)).toEqual([]);
  });
});
