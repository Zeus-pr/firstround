import { describe, expect, it } from 'vitest';
import { hydrateReadinessFromScore } from '../src/readiness/hydrate-score.js';

describe('hydrateReadinessFromScore', () => {
  it('rebuilds LetterProof fields the desk needs from sendability jsonb', () => {
    const readiness = hydrateReadinessFromScore({
      total: 72,
      algorithmVersion: 'readiness-v2',
      gaps: ['Add outcomes'],
      dimensions: {
        evidenceCompleteness: 70,
        outcomeQuality: 65,
        targetRoleCoverage: 80,
        careerConsistency: 75,
        communicationClarity: 70,
      },
      sendability: {
        ok: true,
        hasEmail: true,
        hasLocation: true,
        hasWorkingLink: false,
        blockers: [],
        band: 'supercharge',
        genuineGaps: ['Metric on latest role'],
        underEmphasised: ['Leadership scope'],
        recommendation: {
          action: 'supercharge',
          headline: 'Close with Supercharge',
          body: 'Strong base; sharpen outcomes.',
        },
      },
    });

    expect(readiness.total).toBe(72);
    expect(readiness.band).toBe('supercharge');
    expect(readiness.recommendation.headline).toBe('Close with Supercharge');
    expect(readiness.genuineGaps).toEqual(['Metric on latest role']);
    expect(readiness.underEmphasised).toEqual(['Leadership scope']);
    expect(readiness.dimensions.outcomeQuality).toBe(65);
    expect(readiness.sendability.hasEmail).toBe(true);
  });

  it('falls back safely when sendability extras are missing', () => {
    const readiness = hydrateReadinessFromScore({
      total: 40,
      algorithmVersion: 'readiness-v2',
      gaps: null,
      dimensions: null,
      sendability: { ok: false },
    });

    expect(readiness.band).toBe('strengthen');
    expect(readiness.recommendation.headline).toBeTruthy();
    expect(readiness.genuineGaps).toEqual([]);
    expect(readiness.gaps).toEqual([]);
    expect(readiness.dimensions.evidenceCompleteness).toBe(0);
  });

  it('renames the stored Supercharge headline without moving the score', () => {
    const readiness = hydrateReadinessFromScore({
      total: 78,
      algorithmVersion: 'readiness-v2',
      gaps: [],
      dimensions: {
        evidenceCompleteness: 85,
        outcomeQuality: 80,
        targetRoleCoverage: 68,
        careerConsistency: 96,
        communicationClarity: 82,
      },
      sendability: {
        ok: true,
        band: 'supercharge',
        recommendation: {
          action: 'supercharge',
          headline: 'Good base. Supercharge it.',
          body: 'You are in the sweet middle (78). A short Supercharge pass will lift weak proof before letters leave.',
        },
      },
    });
    expect(readiness.total).toBe(78);
    expect(readiness.recommendation.headline).toBe('Good base. Tighten the proof.');
    expect(readiness.recommendation.body).not.toMatch(/Supercharge pass/);
  });
});
