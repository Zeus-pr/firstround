import type { ReadinessResult } from '@firstround/contracts';

export type ScoreHydrateInput = {
  total: number;
  dimensions: Record<string, number> | null | undefined;
  gaps: string[] | null | undefined;
  sendability: Record<string, unknown> | null | undefined;
  algorithmVersion: string;
};

/** Rebuild LetterProof payload from the score row (extras live in sendability jsonb). */
export function hydrateReadinessFromScore(row: ScoreHydrateInput): ReadinessResult {
  const blob = (row.sendability ?? {}) as Record<string, unknown>;
  const dimensions = (row.dimensions ?? {}) as ReadinessResult['dimensions'];
  const recommendation = (blob.recommendation ?? {
    action: 'strengthen',
    headline: 'LetterProof on file',
    body: 'Open the CV seat to review this score.',
  }) as ReadinessResult['recommendation'];
  const band = (
    typeof blob.band === 'string' ? blob.band : recommendation.action
  ) as ReadinessResult['band'];
  return {
    total: row.total,
    dimensions: {
      evidenceCompleteness: Number(dimensions?.evidenceCompleteness ?? 0),
      outcomeQuality: Number(dimensions?.outcomeQuality ?? 0),
      targetRoleCoverage: Number(dimensions?.targetRoleCoverage ?? 0),
      careerConsistency: Number(dimensions?.careerConsistency ?? 0),
      communicationClarity: Number(dimensions?.communicationClarity ?? 0),
    },
    gaps: Array.isArray(row.gaps) ? row.gaps : [],
    genuineGaps: Array.isArray(blob.genuineGaps) ? (blob.genuineGaps as string[]) : [],
    underEmphasised: Array.isArray(blob.underEmphasised) ? (blob.underEmphasised as string[]) : [],
    checks: Array.isArray(blob.checks) ? (blob.checks as ReadinessResult['checks']) : [],
    sendability: {
      ok: Boolean(blob.ok),
      hasEmail: Boolean(blob.hasEmail),
      hasLocation: Boolean(blob.hasLocation),
      hasWorkingLink: Boolean(blob.hasWorkingLink),
      blockers: Array.isArray(blob.blockers) ? (blob.blockers as string[]) : [],
    },
    confidence: (blob.confidence ?? { overall: 0.5, notes: [] }) as ReadinessResult['confidence'],
    parse: (blob.parse ?? {
      method: 'text',
      quality: 'medium',
      textChars: 0,
      pageEstimate: 0,
      pagesRendered: 0,
      multiColumnSuspected: false,
      sparseText: false,
      ocrUsed: false,
      visionUsed: false,
      notes: [],
    }) as ReadinessResult['parse'],
    normalized: (blob.normalized ?? {
      taxonomyVersion: 'taxonomy-v1',
      skills: [],
      tools: [],
      roleFamilies: [],
    }) as ReadinessResult['normalized'],
    recommendation,
    algorithmVersion: row.algorithmVersion as ReadinessResult['algorithmVersion'],
    band,
  };
}
