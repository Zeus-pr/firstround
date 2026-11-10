import type { PreferencesPayload } from '@firstround/contracts';

export type MatchableJob = {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  workMode: string | null;
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

/** Lightweight job↔preference match for desk “Start my round”. Person gates come later. */
export function scoreJobMatch(prefs: PreferencesPayload, job: MatchableJob): MatchResult {
  const reasons: string[] = [];
  let score = 35;

  const title = norm(job.title);
  const desc = norm(job.descriptionText).slice(0, 1200);
  const hay = `${title} ${desc} ${job.skills.map(norm).join(' ')}`;

  const families = prefs.jobFamilies.map(norm).filter(Boolean);
  if (families.length === 0) {
    score += 10;
    reasons.push('no_family_filter');
  } else {
    const hits = families.filter((f) => hay.includes(f) || title.includes(f));
    if (hits.length > 0) {
      score += Math.min(35, 12 + hits.length * 8);
      reasons.push(`family:${hits[0]}`);
    } else {
      score -= 15;
      reasons.push('family_miss');
    }
  }

  const locations = prefs.locations.map(norm).filter(Boolean);
  const jobLoc = norm(job.location ?? '');
  const remote = job.workMode === 'remote' || jobLoc.includes('remote');
  if (locations.length === 0) {
    score += 8;
    reasons.push('no_location_filter');
  } else if (remote) {
    score += 18;
    reasons.push('remote_ok');
  } else if (jobLoc && locations.some((l) => jobLoc.includes(l) || l.includes(jobLoc))) {
    score += 20;
    reasons.push('location_hit');
  } else {
    score -= 8;
    reasons.push('location_miss');
  }

  const level = prefs.targetLevel ? norm(prefs.targetLevel) : '';
  const seniority = norm(job.seniority ?? '');
  if (level && seniority) {
    if (seniority.includes(level) || level.includes(seniority)) {
      score += 12;
      reasons.push('level_hit');
    } else if (
      (level.includes('senior') && seniority.includes('junior')) ||
      (level.includes('junior') && seniority.includes('director'))
    ) {
      score -= 12;
      reasons.push('level_conflict');
    }
  } else {
    score += 5;
  }

  if (job.trustScore >= 75) {
    score += 8;
    reasons.push('trusted_job');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { job, matchScore: score, reasons };
}

export function rankMatches(
  prefs: PreferencesPayload,
  jobs: MatchableJob[],
  opts: { minMatch?: number; limit?: number } = {},
): MatchResult[] {
  const minMatch = opts.minMatch ?? 55;
  const limit = opts.limit ?? 5;
  return jobs
    .map((job) => scoreJobMatch(prefs, job))
    .filter((r) => r.matchScore >= minMatch)
    .sort((a, b) => b.matchScore - a.matchScore || b.job.trustScore - a.job.trustScore)
    .slice(0, limit);
}
