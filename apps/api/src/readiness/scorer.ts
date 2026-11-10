import {
  ALGORITHM_VERSION,
  type CvFacts,
  type FieldConfidence,
  type ParseQuality,
  type ReadinessBand,
  type ReadinessCheck,
  type ReadinessRecommendation,
  type ReadinessResult,
  type SendabilityChecklist,
} from '@firstround/contracts';
import { normalizeLexicon, normalizeSkill, taxonomyCoverage } from './taxonomy.js';

const WEIGHTS = {
  evidenceCompleteness: 0.2,
  outcomeQuality: 0.25,
  targetRoleCoverage: 0.25,
  careerConsistency: 0.15,
  communicationClarity: 0.15,
} as const;

export const METRIC_RE =
  /(\d+(\.\d+)?\s*%|\b\d+(\.\d+)?\s*(k|m|b|million|billion|users|customers|revenue|arr|mrr)\b|\$\s?\d|\b\d+x\b)/i;
export const OWNERSHIP_RE =
  /\b(led|owned|built|shipped|launched|grew|cut|reduced|increased|designed|drove|ran|created)\b/i;
export const VAGUE_RE = /responsible for|helped with|worked on|various tasks|duties included/i;

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

function defaultConfidence(facts: CvFacts, parse: ParseQuality): FieldConfidence {
  const roles = facts.roles ?? [];
  const contactBits =
    Number((facts.emails?.length ?? 0) > 0) +
    Number((facts.phones?.length ?? 0) > 0) +
    Number((facts.locations?.length ?? 0) > 0);
  const contact = Math.min(1, 0.35 + contactBits * 0.22);
  const rolesScore =
    roles.length === 0
      ? 0.25
      : Math.min(
          1,
          0.45 +
            roles.length * 0.08 +
            (roles.filter((r) => r.startDate || r.endDate || r.isCurrent).length / roles.length) *
              0.2,
        );
  const skills = Math.min(1, 0.3 + (facts.skills?.length ?? 0) * 0.05);
  const education = (facts.education?.length ?? 0) > 0 ? 0.85 : 0.45;
  const parseBoost = parse.quality === 'high' ? 0.08 : parse.quality === 'medium' ? 0 : -0.08;
  const overall = Math.max(
    0.2,
    Math.min(1, (contact + rolesScore + skills + education) / 4 + parseBoost),
  );
  const notes: string[] = [];
  if (parse.visionUsed) notes.push('Vision pass helped with layout.');
  if (parse.multiColumnSuspected) notes.push('Multi-column layout was suspected.');
  if (overall < 0.55) notes.push('Some fields are uncertain; we scored gently.');
  return { overall, contact, roles: rolesScore, skills, education, notes };
}

function bandFor(total: number): ReadinessBand {
  if (total >= 80) return 'ready';
  if (total >= 60) return 'supercharge';
  return 'strengthen';
}

function recommendationFor(band: ReadinessBand, total: number): ReadinessRecommendation {
  if (band === 'ready') {
    return {
      action: 'continue',
      headline: 'Ready for letters',
      body: `Your CV already carries enough proof (${total}). We can write honest outreach from this.`,
    };
  }
  if (band === 'supercharge') {
    return {
      action: 'supercharge',
      headline: 'Good base. Tighten the proof.',
      body: `You are in the sweet middle (${total}). Suggestions name the lines to sharpen. This score stays as it is.`,
    };
  }
  return {
    action: 'strengthen',
    headline: 'Strengthen the proof first',
    body: `Score ${total} means the letter would lean on thin evidence. Fix the gaps below, then we write.`,
  };
}

/**
 * LetterProof readiness-v2.
 * Soft priors so ordinary CVs land in supercharge, not failure.
 * Career gaps and non-linear paths are never penalized.
 * Missing metrics lower proof quality; they do not invent failure.
 * Outcome and clarity use counts, not ratios, so an extra specific line cannot lower the score.
 */
export function scoreCvReadiness(
  facts: CvFacts,
  targetHints: string[] = [],
  opts: {
    parse?: ParseQuality;
    confidence?: FieldConfidence;
  } = {},
): ReadinessResult {
  const roles = facts.roles ?? [];
  const skills = facts.skills ?? [];
  const parse: ParseQuality = opts.parse ?? {
    method: 'text',
    textChars: 0,
    pageEstimate: 0,
    pagesRendered: 0,
    multiColumnSuspected: false,
    sparseText: false,
    ocrUsed: false,
    visionUsed: false,
    quality: 'medium',
    notes: [],
  };
  const confidence = opts.confidence ?? defaultConfidence(facts, parse);
  const normalized = normalizeLexicon({
    skills: [...skills, ...roles.flatMap((r) => r.tools ?? [])],
    titles: roles.map((r) => r.title),
    hints: [...targetHints, ...(facts.targetRoleHints ?? [])],
  });

  const evidenceCompleteness = scoreEvidence(roles, skills, facts, confidence);
  const outcomeQuality = scoreOutcomes(roles, confidence);
  const targetRoleCoverage = scoreTargetCoverage(
    roles,
    normalized.skills,
    normalized.families,
    targetHints,
  );
  const careerConsistency = scoreConsistency(roles);
  const communicationClarity = scoreClarity(roles, facts.summary ?? null);

  const dimensions = {
    evidenceCompleteness,
    outcomeQuality,
    targetRoleCoverage,
    careerConsistency,
    communicationClarity,
  };

  const raw = clamp(
    dimensions.evidenceCompleteness * WEIGHTS.evidenceCompleteness +
      dimensions.outcomeQuality * WEIGHTS.outcomeQuality +
      dimensions.targetRoleCoverage * WEIGHTS.targetRoleCoverage +
      dimensions.careerConsistency * WEIGHTS.careerConsistency +
      dimensions.communicationClarity * WEIGHTS.communicationClarity,
  );

  const allBullets = roles.flatMap((r) => [...(r.bullets ?? []), ...(r.metrics ?? [])]);
  const metricCount = allBullets.filter((b) => METRIC_RE.test(b)).length;
  const vagueOnly =
    allBullets.length > 0 && allBullets.every((b) => VAGUE_RE.test(b) && !METRIC_RE.test(b));
  // Only truly sparse CVs cap below 60. Ordinary one-role CVs stay in supercharge.
  const thinProof = (roles.length === 0 || vagueOnly) && metricCount === 0 && skills.length < 2;

  // Soft prior: ordinary CVs sit near the middle; thin proof stays coachable below 60.
  const prior = thinProof ? 48 : roles.length > 0 ? 56 : 40;
  const conf = Math.max(0.35, Math.min(1, confidence.overall));
  // Blend prior + raw; high confidence and strong raw can clear 80.
  let total = clamp(prior * (0.32 - conf * 0.1) + raw * (0.68 + conf * 0.1));

  const sendability = scoreSendability(facts);
  if (sendability.ok && metricCount >= 2 && normalized.skills.length >= 5) {
    total = clamp(total + 4);
  } else if (sendability.ok && roles.length > 0 && !thinProof) {
    total = clamp(total + 2);
  }
  if (thinProof) total = Math.min(total, 58);
  const checks = buildChecks(facts, dimensions, sendability, normalized.skills);
  const { genuineGaps, underEmphasised, gaps } = buildGapLists(
    dimensions,
    sendability,
    roles,
    skills,
    facts,
  );
  const band = bandFor(total);

  return {
    total,
    dimensions,
    gaps,
    genuineGaps,
    underEmphasised,
    checks,
    sendability,
    confidence,
    parse,
    normalized,
    recommendation: recommendationFor(band, total),
    algorithmVersion: ALGORITHM_VERSION,
    band,
  };
}

/** Supercharge may publish a higher score. It may not publish a lower one. */
export function lockReadinessFloor(prior: ReadinessResult, next: ReadinessResult): ReadinessResult {
  if (next.total >= prior.total) return next;
  const band = bandFor(prior.total);
  return {
    ...prior,
    total: prior.total,
    band,
    recommendation: recommendationFor(band, prior.total),
  };
}

function scoreEvidence(
  roles: CvFacts['roles'],
  skills: string[],
  facts: CvFacts,
  confidence: FieldConfidence,
): number {
  // Soft floor so thin-but-real CVs still feel coachable.
  if (roles.length === 0) return clamp(28 + confidence.roles * 10);
  let score = 52;
  score += Math.min(18, roles.length * 5);
  const dated = roles.filter((r) => r.startDate || r.endDate || r.isCurrent).length;
  score += Math.min(12, dated * 3);
  const withTools = roles.filter((r) => (r.tools?.length ?? 0) > 0).length;
  score += Math.min(10, withTools * 4);
  const withScope = roles.filter((r) => r.scope || (r.bullets?.length ?? 0) > 0).length;
  score += Math.min(8, withScope * 2);
  if (skills.length >= 3) score += 4;
  if (skills.length >= 8) score += 3;
  if ((facts.education?.length ?? 0) > 0) score += 4;
  return clamp(score * (0.85 + confidence.roles * 0.15));
}

function scoreOutcomes(roles: CvFacts['roles'], confidence: FieldConfidence): number {
  if (roles.length === 0) return 45;
  const allBullets = roles.flatMap((r) => [...(r.bullets ?? []), ...(r.metrics ?? [])]);
  if (allBullets.length === 0) return 52;
  const withMetric = allBullets.filter((b) => METRIC_RE.test(b)).length;
  const withOwnership = allBullets.filter((b) => OWNERSHIP_RE.test(b)).length;
  // Counts, not ratios. Extra context beside an existing number must not dilute proof.
  const score = 56 + Math.min(32, withMetric * 8) + Math.min(12, withOwnership * 4);
  return clamp(score * (0.9 + confidence.roles * 0.1));
}

function scoreTargetCoverage(
  roles: CvFacts['roles'],
  normalizedSkills: string[],
  families: string[],
  hints: string[],
): number {
  if (hints.length === 0 && families.length === 0) {
    // No target yet: generous coherence score, not a penalty.
    return clamp(62 + Math.min(12, normalizedSkills.length) + Math.min(10, roles.length * 2));
  }
  const coverage = taxonomyCoverage(normalizedSkills, families.length ? families : ['product']);
  const hay = `${roles.map((r) => r.title).join(' ')} ${normalizedSkills.join(' ')}`.toLowerCase();
  const hintHits = hints.filter((h) => h && hay.includes(normalizeSkill(h))).length;
  const hintRatio = hints.length ? hintHits / hints.length : coverage;
  return clamp(55 + coverage * 30 + hintRatio * 15);
}

function scoreConsistency(roles: CvFacts['roles']): number {
  // Start high. Only chronology errors reduce. Gaps/breaks/non-linear paths never penalized.
  if (roles.length === 0) return 78;
  let score = 96;
  const intervals: { start: number; end: number }[] = [];
  for (const role of roles) {
    const start = parseLooseDate(role.startDate);
    const end = role.isCurrent ? Date.now() : parseLooseDate(role.endDate);
    if (start && end && end < start) score -= 18;
    if (start && end) intervals.push({ start, end });
  }
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i]!;
      const b = intervals[j]!;
      const overlap = a.start < b.end && b.start < a.end;
      const bothLong = a.end - a.start > 90 * 86400000 && b.end - b.start > 90 * 86400000;
      if (overlap && bothLong) score -= 12;
    }
  }
  return clamp(score);
}

function scoreClarity(roles: CvFacts['roles'], summary: string | null): number {
  const bullets = roles.flatMap((r) => r.bullets ?? []);
  if (bullets.length === 0) return summary && summary.length > 40 ? 58 : 46;
  let score = 54;
  const specific = bullets.filter((b) => b.split(/\s+/).length >= 8 && /[a-z]/i.test(b)).length;
  // Each clear line adds. A short extra line does not shrink the lines already counted.
  score += Math.min(28, specific * 8);
  const tooVague = bullets.filter((b) => VAGUE_RE.test(b) && !METRIC_RE.test(b)).length;
  score -= Math.min(14, tooVague * 3);
  if (summary && summary.length > 60) score += 6;
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

function buildChecks(
  facts: CvFacts,
  dimensions: ReadinessResult['dimensions'],
  sendability: SendabilityChecklist,
  normalizedSkills: string[],
): ReadinessCheck[] {
  const roles = facts.roles ?? [];
  const bullets = roles.flatMap((r) => r.bullets ?? []);
  const metricCount = bullets.filter((b) => METRIC_RE.test(b)).length;
  return [
    {
      id: 'has-roles',
      label: 'Work history found',
      passed: roles.length > 0,
      severity: 'hard',
    },
    {
      id: 'dated-roles',
      label: 'Roles include dates',
      passed: roles.some((r) => r.startDate || r.endDate || r.isCurrent),
      severity: 'soft',
    },
    {
      id: 'metrics',
      label: 'At least one numbered outcome',
      passed: metricCount > 0,
      severity: 'soft',
    },
    {
      id: 'skills',
      label: 'Skills or tools listed',
      passed: normalizedSkills.length >= 3,
      severity: 'soft',
    },
    {
      id: 'contact-email',
      label: 'Contact email present',
      passed: sendability.hasEmail,
      severity: 'hard',
    },
    {
      id: 'clarity',
      label: 'Bullets read clearly',
      passed: dimensions.communicationClarity >= 60,
      severity: 'soft',
    },
    {
      id: 'chronology',
      label: 'Dates look consistent',
      passed: dimensions.careerConsistency >= 85,
      severity: 'hard',
    },
  ];
}

function buildGapLists(
  dimensions: ReadinessResult['dimensions'],
  sendability: SendabilityChecklist,
  roles: CvFacts['roles'],
  skills: string[],
  facts: CvFacts,
): { genuineGaps: string[]; underEmphasised: string[]; gaps: string[] } {
  const genuineGaps: string[] = [];
  const underEmphasised: string[] = [];

  if (roles.length === 0) {
    genuineGaps.push('We could not find work history on this file. Try another export.');
  }
  if (dimensions.evidenceCompleteness < 62) {
    genuineGaps.push('Add clearer role dates, tools, and what you owned on each job.');
  }
  if (dimensions.outcomeQuality < 58) {
    genuineGaps.push(
      'Add a few numbers: scale, time saved, revenue, conversion, or quality change.',
    );
  } else if (dimensions.outcomeQuality < 78) {
    underEmphasised.push('You have some outcomes. Pull the strongest numbers closer to the top.');
  }
  if (dimensions.targetRoleCoverage < 62) {
    genuineGaps.push('Spell out skills and projects that match the roles you want next.');
  } else if (dimensions.targetRoleCoverage < 80 && skills.length > 0) {
    underEmphasised.push('Your skills are present. Mirror the wording of the roles you want.');
  }
  if (dimensions.careerConsistency < 90) {
    genuineGaps.push(
      'Check overlapping full-time dates or end dates that come before start dates.',
    );
  }
  if (dimensions.communicationClarity < 58) {
    genuineGaps.push('Rewrite vague bullets into short, specific lines a stranger can parse.');
  } else if (dimensions.communicationClarity < 78) {
    underEmphasised.push('Tighten a few vague lines so ownership and impact read first.');
  }
  if ((facts.summary?.length ?? 0) > 40 && dimensions.communicationClarity < 85) {
    underEmphasised.push('Your summary helps. Keep it short and role-specific.');
  }

  genuineGaps.push(...sendability.blockers);
  const gaps = [...new Set([...genuineGaps, ...underEmphasised])].slice(0, 10);
  return {
    genuineGaps: [...new Set(genuineGaps)].slice(0, 8),
    underEmphasised: [...new Set(underEmphasised)].slice(0, 6),
    gaps,
  };
}
