import {
  ALGORITHM_VERSION,
  type CvFacts,
  type ReadinessResult,
  type SendabilityChecklist,
} from '@firstround/contracts';

const WEIGHTS = {
  evidenceCompleteness: 0.2,
  outcomeQuality: 0.25,
  targetRoleCoverage: 0.25,
  careerConsistency: 0.15,
  communicationClarity: 0.15,
} as const;

const METRIC_RE =
  /(\d+(\.\d+)?\s*%|\b\d+(\.\d+)?\s*(k|m|b|million|billion|users|customers|revenue|arr|mrr)\b|\$\s?\d|\b\d+x\b)/i;
const TOOLISH_RE =
  /\b(react|node|python|java|sql|aws|gcp|azure|figma|jira|salesforce|excel|tableau|looker|docker|kubernetes|typescript|go|rust)\b/i;

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseLooseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v || v === 'present' || v === 'current' || v === 'now') return Date.now();
  const m = v.match(/^(\d{4})(?:[-/.](\d{1,2}))?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : 0;
  if (year < 1970 || year > 2100) return null;
  return Date.UTC(year, month, 1);
}

/** Deterministic readiness scorer. Missing evidence lowers completeness; it does not invent failure. */
export function scoreCvReadiness(facts: CvFacts, targetHints: string[] = []): ReadinessResult {
  const roles = facts.roles ?? [];
  const skills = facts.skills ?? [];
  const hints = [...targetHints, ...(facts.targetRoleHints ?? [])].map((h) => h.toLowerCase());

  const evidenceCompleteness = scoreEvidence(roles, skills, facts);
  const outcomeQuality = scoreOutcomes(roles);
  const targetRoleCoverage = scoreTargetCoverage(roles, skills, hints);
  const careerConsistency = scoreConsistency(roles);
  const communicationClarity = scoreClarity(roles, facts.summary ?? null);

  const dimensions = {
    evidenceCompleteness,
    outcomeQuality,
    targetRoleCoverage,
    careerConsistency,
    communicationClarity,
  };

  const total = clamp(
    dimensions.evidenceCompleteness * WEIGHTS.evidenceCompleteness +
      dimensions.outcomeQuality * WEIGHTS.outcomeQuality +
      dimensions.targetRoleCoverage * WEIGHTS.targetRoleCoverage +
      dimensions.careerConsistency * WEIGHTS.careerConsistency +
      dimensions.communicationClarity * WEIGHTS.communicationClarity,
  );

  const sendability = scoreSendability(facts);
  const gaps = buildGaps(dimensions, sendability, roles);

  return {
    total,
    dimensions,
    gaps,
    sendability,
    algorithmVersion: ALGORITHM_VERSION,
    band: total >= 85 ? 'ready' : total >= 70 ? 'improve' : 'limited',
  };
}

function scoreEvidence(roles: CvFacts['roles'], skills: string[], facts: CvFacts): number {
  if (roles.length === 0) return 15;
  let score = 35;
  score += Math.min(25, roles.length * 6);
  const dated = roles.filter((r) => r.startDate || r.endDate || r.isCurrent).length;
  score += Math.min(15, dated * 4);
  const withTools = roles.filter(
    (r) => (r.tools?.length ?? 0) > 0 || r.bullets.some((b) => TOOLISH_RE.test(b)),
  ).length;
  score += Math.min(15, withTools * 5);
  const withScope = roles.filter((r) => r.scope || (r.bullets?.length ?? 0) > 0).length;
  score += Math.min(10, withScope * 3);
  if (skills.length >= 5) score += 5;
  if ((facts.education?.length ?? 0) > 0) score += 5;
  return clamp(score);
}

function scoreOutcomes(roles: CvFacts['roles']): number {
  if (roles.length === 0) return 20;
  const allBullets = roles.flatMap((r) => [...(r.bullets ?? []), ...(r.metrics ?? [])]);
  if (allBullets.length === 0) return 25;
  const withMetric = allBullets.filter((b) => METRIC_RE.test(b)).length;
  const ratio = withMetric / allBullets.length;
  // Missing metrics lower proof quality; they do not assert poor performance.
  return clamp(30 + ratio * 70);
}

function scoreTargetCoverage(roles: CvFacts['roles'], skills: string[], hints: string[]): number {
  if (hints.length === 0) {
    // No target yet: score from internal role/skill coherence, not a penalty for missing prefs.
    return clamp(55 + Math.min(20, skills.length) + Math.min(15, roles.length * 3));
  }
  const hay =
    `${roles.map((r) => `${r.title} ${r.bullets.join(' ')}`).join(' ')} ${skills.join(' ')}`.toLowerCase();
  const hits = hints.filter((h) => h && hay.includes(h)).length;
  const ratio = hits / hints.length;
  return clamp(35 + ratio * 65);
}

function scoreConsistency(roles: CvFacts['roles']): number {
  // Start high. Only chronology errors and contradictions reduce the score.
  // Gaps, breaks, lateral moves, and non-linear paths are never penalized.
  if (roles.length === 0) return 70;
  let score = 100;
  const intervals: { start: number; end: number; title: string }[] = [];
  for (const role of roles) {
    const start = parseLooseDate(role.startDate);
    const end = role.isCurrent ? Date.now() : parseLooseDate(role.endDate);
    if (start && end && end < start) score -= 25;
    if (start && end) intervals.push({ start, end, title: role.title });
  }
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i]!;
      const b = intervals[j]!;
      const overlap = a.start < b.end && b.start < a.end;
      const bothLong = a.end - a.start > 90 * 86400000 && b.end - b.start > 90 * 86400000;
      if (overlap && bothLong) score -= 15;
    }
  }
  return clamp(score);
}

function scoreClarity(roles: CvFacts['roles'], summary: string | null): number {
  const bullets = roles.flatMap((r) => r.bullets ?? []);
  if (bullets.length === 0) return summary && summary.length > 40 ? 55 : 30;
  let score = 40;
  const specific = bullets.filter((b) => b.split(/\s+/).length >= 8 && /[a-z]/i.test(b)).length;
  score += Math.min(35, (specific / bullets.length) * 35);
  const tooVague = bullets.filter(
    (b) => /responsible for|helped with|worked on/i.test(b) && !METRIC_RE.test(b),
  ).length;
  score -= Math.min(20, tooVague * 4);
  if (summary && summary.length > 60) score += 10;
  return clamp(score);
}

function scoreSendability(facts: CvFacts): SendabilityChecklist {
  const hasEmail = (facts.emails?.length ?? 0) > 0;
  const hasLocation = (facts.locations?.length ?? 0) > 0;
  const links = facts.links ?? { other: [] };
  const hasWorkingLink = Boolean(
    links.linkedin || links.github || links.portfolio || (links.other?.length ?? 0) > 0,
  );
  const blockers: string[] = [];
  if (!hasEmail) blockers.push('Add a working email so letters can leave from your inbox later.');
  if (!hasLocation) blockers.push('Add a city or region so role matches stay realistic.');
  if (!hasWorkingLink)
    blockers.push('Add LinkedIn, GitHub, or a portfolio link when you have one.');
  return { ok: blockers.length === 0, hasEmail, hasLocation, hasWorkingLink, blockers };
}

function buildGaps(
  dimensions: ReadinessResult['dimensions'],
  sendability: SendabilityChecklist,
  roles: CvFacts['roles'],
): string[] {
  const gaps: string[] = [];
  if (dimensions.evidenceCompleteness < 70) {
    gaps.push('Add clearer role dates, tools, and what you owned on each job.');
  }
  if (dimensions.outcomeQuality < 70) {
    gaps.push('Add a few numbers: scale, time saved, revenue, conversion, or quality change.');
  }
  if (dimensions.targetRoleCoverage < 70) {
    gaps.push('Spell out skills and projects that match the roles you want next.');
  }
  if (dimensions.careerConsistency < 100) {
    gaps.push('Check overlapping full-time dates or end dates that come before start dates.');
  }
  if (dimensions.communicationClarity < 70) {
    gaps.push('Rewrite vague bullets into short, specific lines a stranger can parse.');
  }
  if (roles.length === 0)
    gaps.push('We could not find work history on this file. Try another export.');
  gaps.push(...sendability.blockers);
  return [...new Set(gaps)].slice(0, 8);
}
