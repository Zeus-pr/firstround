import {
  EMPTY_PREFERENCES_CRITERIA,
  type PreferencesCriteria,
  type PreferencesPayload,
} from '@firstround/contracts';
import { familyOfText, type RoleFamily } from './role-family.js';

export type MatchableJob = {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  workMode: string | null;
  employmentType: string | null;
  seniority: string | null;
  descriptionText: string;
  skills: string[];
  trustScore: number;
  sourceUrl: string | null;
  invitedEmail: string | null;
};

export type MatchResult = {
  job: MatchableJob;
  matchScore: number;
  reasons: string[];
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function criteriaOf(prefs: PreferencesPayload): PreferencesCriteria {
  const raw = prefs.criteria ?? {};
  return {
    ...EMPTY_PREFERENCES_CRITERIA,
    ...raw,
    desiredCompanies: raw.desiredCompanies ?? [],
    avoidCompanies: raw.avoidCompanies ?? [],
    industries: raw.industries ?? [],
    skills: raw.skills ?? [],
    workModes: raw.workModes ?? [],
    employmentTypes: raw.employmentTypes ?? [],
    keywords: raw.keywords ?? [],
  };
}

/**
 * Soft job↔preference match (Instahyre / Naukri-style).
 * Empty fields are neutral. Hits boost. Misses demote mildly — never hard-exclude here.
 */
export function scoreJobMatch(
  prefs: PreferencesPayload,
  job: MatchableJob,
  signal?: { primaryFamily?: RoleFamily | null },
): MatchResult {
  const reasons: string[] = [];
  let score = 40;
  const c = criteriaOf(prefs);
  const primary =
    signal?.primaryFamily && signal.primaryFamily !== 'other' ? signal.primaryFamily : null;
  if (primary) {
    const jobFamily = familyOfText(job.title);
    if (jobFamily !== primary) {
      return { job, matchScore: 0, reasons: ['family_clash', `job:${jobFamily}`] };
    }
    score += 28;
    reasons.push(`family:${jobFamily}`);
    if (primary === 'commercial' && /\bsales executive\b/i.test(job.title)) {
      score -= 18;
      reasons.push('sales_exec_soft');
    }
  }

  const title = norm(job.title);
  const company = norm(job.companyName);
  const desc = norm(job.descriptionText).slice(0, 1400);
  const skillHay = job.skills.map(norm).join(' ');
  const hay = `${title} ${desc} ${skillHay} ${company}`;

  const families = prefs.jobFamilies.map(norm).filter(Boolean);
  if (families.length === 0) {
    score += 6;
  } else {
    const hits = families.filter((f) => hay.includes(f) || title.includes(f));
    if (hits.length > 0) {
      score += Math.min(28, 10 + hits.length * 6);
      reasons.push(`family:${hits[0]}`);
    } else {
      score -= 10;
      reasons.push('family_soft_miss');
    }
  }

  const locations = prefs.locations.map(norm).filter(Boolean);
  const jobLoc = norm(job.location ?? '');
  const remote = job.workMode === 'remote' || jobLoc.includes('remote');
  if (locations.length === 0) {
    score += 5;
  } else if (remote) {
    score += 14;
    reasons.push('remote_ok');
  } else if (jobLoc && locations.some((l) => jobLoc.includes(l) || l.includes(jobLoc))) {
    score += 16;
    reasons.push('location_hit');
  } else if (c.openToRelocation === true) {
    score += 4;
    reasons.push('relocation_ok');
  } else {
    score -= 6;
    reasons.push('location_soft_miss');
  }

  const level = prefs.targetLevel ? norm(prefs.targetLevel) : '';
  const seniority = norm(job.seniority ?? '');
  if (level && seniority) {
    if (seniority.includes(level) || level.includes(seniority)) {
      score += 10;
      reasons.push('level_hit');
    } else if (
      (level.includes('senior') && seniority.includes('junior')) ||
      (level.includes('junior') && seniority.includes('director'))
    ) {
      score -= 8;
      reasons.push('level_soft_miss');
    }
  } else {
    score += 3;
  }

  const desired = c.desiredCompanies.map(norm).filter(Boolean);
  if (desired.length > 0) {
    if (desired.some((d) => company.includes(d) || d.includes(company))) {
      score += 18;
      reasons.push('desired_company');
    }
    // No miss penalty — desired list is aspirational, not exclusive.
  }

  const avoid = c.avoidCompanies.map(norm).filter(Boolean);
  if (avoid.some((a) => company.includes(a) || a.includes(company))) {
    score -= 22;
    reasons.push('avoid_company');
  }

  const industries = c.industries.map(norm).filter(Boolean);
  if (industries.length > 0) {
    const hits = industries.filter((i) => hay.includes(i));
    if (hits.length > 0) {
      score += Math.min(12, 6 + hits.length * 3);
      reasons.push(`industry:${hits[0]}`);
    } else {
      score -= 3;
    }
  }

  const wantSkills = c.skills.map(norm).filter(Boolean);
  if (wantSkills.length > 0) {
    const hits = wantSkills.filter((s) => hay.includes(s));
    if (hits.length > 0) {
      score += Math.min(16, 4 + hits.length * 3);
      reasons.push(`skill:${hits[0]}`);
    } else {
      score -= 4;
    }
  }

  const keywords = c.keywords.map(norm).filter(Boolean);
  if (keywords.length > 0) {
    const hits = keywords.filter((k) => hay.includes(k));
    if (hits.length > 0) {
      score += Math.min(12, 3 + hits.length * 3);
      reasons.push(`keyword:${hits[0]}`);
    }
  }

  const modes = c.workModes.map(norm);
  if (modes.length > 0) {
    const mode = norm(job.workMode ?? (remote ? 'remote' : ''));
    if (mode && modes.includes(mode)) {
      score += 8;
      reasons.push('work_mode_hit');
    } else if (mode) {
      score -= 3;
    }
  }

  const empTypes = c.employmentTypes.map(norm).filter(Boolean);
  const jobEmp = norm(job.employmentType ?? '');
  if (empTypes.length > 0 && jobEmp) {
    if (empTypes.some((t) => jobEmp.includes(t) || t.includes(jobEmp))) {
      score += 6;
      reasons.push('employment_type_hit');
    } else {
      score -= 2;
    }
  }

  // CTC text is sparse on Naukri rows; only boost when numbers appear in the description.
  if (c.expectedCtcMinLakh != null || c.expectedCtcMaxLakh != null) {
    const ctcMention = /\b(\d{1,3}(?:\.\d+)?)\s*(?:lpa|lakh|lac)\b/i.exec(job.descriptionText);
    if (ctcMention) {
      const listed = Number(ctcMention[1]);
      const min = c.expectedCtcMinLakh ?? 0;
      const max = c.expectedCtcMaxLakh ?? 500;
      if (listed >= min && listed <= max) {
        score += 8;
        reasons.push('ctc_band_hit');
      } else {
        score -= 4;
        reasons.push('ctc_band_soft_miss');
      }
    }
  }

  if (job.trustScore >= 75) {
    score += 6;
    reasons.push('trusted_job');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { job, matchScore: score, reasons };
}

export function rankMatches(
  prefs: PreferencesPayload,
  jobs: MatchableJob[],
  opts: { minMatch?: number; limit?: number; primaryFamily?: RoleFamily | null } = {},
): MatchResult[] {
  const minMatch = opts.minMatch ?? 48;
  const limit = opts.limit ?? 5;
  return jobs
    .map((job) => scoreJobMatch(prefs, job, { primaryFamily: opts.primaryFamily }))
    .filter((r) => r.matchScore >= minMatch && !r.reasons.includes('family_clash'))
    .sort((a, b) => b.matchScore - a.matchScore || b.job.trustScore - a.job.trustScore)
    .slice(0, limit);
}
