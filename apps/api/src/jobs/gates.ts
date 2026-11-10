/**
 * U7 five-gates domain logic — pure functions, no Nest/DB.
 * Scores are 0–100 unless noted; thresholds from architecture doc (v2).
 */

export const GATE_THRESHOLDS = {
  jobTrust: 75,
  jobMatch: 78,
  personJob: 80,
  addressIdentity: 75,
  mailboxConfidence: 90,
} as const;

export const GATES_ALGORITHM_VERSION = 'u7.0.0';

export type GateName = keyof typeof GATE_THRESHOLDS;

export type MailboxVerifierStatus = 'valid' | 'accept_all' | 'unknown' | 'invalid' | 'disposable';

export type AddressProvenance = 'published-with-url' | 'inferred' | 'direct-public';

export type CandidatePreferences = {
  /** Required before any job is gated; absence excludes (no guessing). */
  workAuthorization?: string | null;
  targetLevel?: string | null;
  locations?: string[];
  remoteOk?: boolean;
};

export type JobForHardFilter = {
  workAuthorizationRequired?: string | null;
  seniorityLevel?: string | null;
  location?: string | null;
  workMode?: 'remote' | 'hybrid' | 'onsite' | null;
  closed?: boolean;
};

export type PersonScoringFeatures = {
  /** FairnessGuard: never used in scoring. */
  displayName?: string | null;
  listedOnJob: boolean;
  titleMatch: number;
  teamAlignment: number;
  sourceQuality: number;
  conflictSignals: number;
  employmentFresh: boolean;
};

export type AddressScoringFeatures = {
  /** FairnessGuard: never used in scoring. */
  displayName?: string | null;
  directPublicTie: number;
  patternSupport: number;
  localPartCorrespondence: number;
  corporateDomainMatch: boolean;
  employmentCurrent: boolean;
};

export type GateDecision = {
  gate: GateName;
  score: number;
  threshold: number;
  passed: boolean;
  reason: string;
  algorithmVersion: string;
  inputsSummary: Record<string, string | number | boolean | null>;
};

export type GateEvalInput = {
  algorithmVersion?: string;
  jobTrustScore: number;
  jobMatchScore: number;
  /** Used when personScoringFeatures is omitted. */
  personJobScore?: number;
  personScoringFeatures?: PersonScoringFeatures;
  /** Used when addressScoringFeatures is omitted. */
  addressIdentityScore?: number;
  addressScoringFeatures?: AddressScoringFeatures;
  mailboxConfidenceScore: number;
  mailboxStatus: MailboxVerifierStatus;
  /** Address extracted from job source text (invited channel). */
  invitedChannel?: { address: string; inSourceText: boolean } | null;
  addressProvenance: AddressProvenance;
  inferredAddressPolicyEnabled?: boolean;
  /** Completed verifier calls for this job; 3rd attempt is refused (max 2). */
  verificationAttemptCount: number;
  thresholds?: Partial<typeof GATE_THRESHOLDS>;
};

export type GateEvalResult = {
  overallPass: boolean;
  decisions: GateDecision[];
  skipReason?: string;
  shortlistEligible: boolean;
};

const SENIORITY_ORDER = [
  'intern',
  'junior',
  'associate',
  'mid',
  'senior',
  'lead',
  'staff',
  'principal',
  'director',
  'vp',
  'c-level',
] as const;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function seniorityIndex(level: string): number {
  const n = normalizeToken(level);
  const i = SENIORITY_ORDER.indexOf(n as (typeof SENIORITY_ORDER)[number]);
  if (i >= 0) return i;
  if (n.includes('intern')) return 0;
  if (n.includes('junior') || n.includes('entry')) return 1;
  if (n.includes('senior') || n.includes('sr')) return 4;
  if (n.includes('lead') || n.includes('manager')) return 5;
  if (n.includes('director')) return 8;
  if (n.includes('vp') || n.includes('vice')) return 9;
  return 3;
}

function seniorityConflicts(
  preference: string | null | undefined,
  jobLevel: string | null | undefined,
): boolean {
  if (!preference?.trim() || !jobLevel?.trim()) return false;
  const gap = Math.abs(seniorityIndex(preference) - seniorityIndex(jobLevel));
  return gap >= 3;
}

function locationConflicts(prefs: CandidatePreferences, job: JobForHardFilter): boolean {
  if (job.workMode === 'remote') return false;
  if (prefs.remoteOk && job.workMode === 'hybrid') return false;
  const locations = prefs.locations ?? [];
  if (locations.length === 0 || !job.location?.trim()) return false;
  const jobLoc = normalizeToken(job.location);
  const match = locations.some((loc) => {
    const p = normalizeToken(loc);
    return jobLoc.includes(p) || p.includes(jobLoc);
  });
  return !match;
}

function workAuthConflicts(prefs: CandidatePreferences, job: JobForHardFilter): boolean {
  const required = job.workAuthorizationRequired?.trim();
  const have = prefs.workAuthorization?.trim();
  if (!required || !have) return false;
  return normalizeToken(required) !== normalizeToken(have);
}

export function evaluateHardFilters(
  prefs: CandidatePreferences,
  job: JobForHardFilter,
): { ok: true } | { ok: false; reason: string } {
  if (!prefs.workAuthorization?.trim()) {
    return { ok: false, reason: 'missing_work_authorization_on_preferences' };
  }
  if (job.closed) {
    return { ok: false, reason: 'job_closed_or_stale' };
  }
  if (workAuthConflicts(prefs, job)) {
    return { ok: false, reason: 'work_authorization_conflict' };
  }
  if (seniorityConflicts(prefs.targetLevel, job.seniorityLevel)) {
    return { ok: false, reason: 'seniority_outside_preference' };
  }
  if (locationConflicts(prefs, job)) {
    return { ok: false, reason: 'location_conflict_with_preferences' };
  }
  return { ok: true };
}

/** FairnessGuard: displayName is ignored. */
export function computePersonJobScore(features: PersonScoringFeatures): number {
  const base =
    (features.listedOnJob ? 30 : 0) +
    features.titleMatch * 0.28 +
    features.teamAlignment * 0.22 +
    features.sourceQuality * 0.2 -
    features.conflictSignals * 0.25;
  const freshPenalty = features.employmentFresh ? 0 : 18;
  return Math.round(Math.max(0, Math.min(100, base - freshPenalty)));
}

/** FairnessGuard: displayName is ignored. */
export function computeAddressIdentityScore(features: AddressScoringFeatures): number {
  const domain = features.corporateDomainMatch ? 10 : 0;
  const employment = features.employmentCurrent ? 10 : 0;
  const raw =
    features.directPublicTie * 0.4 +
    features.patternSupport * 0.2 +
    features.localPartCorrespondence * 0.15 +
    domain +
    employment;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function resolveVersion(input: GateEvalInput): string {
  return input.algorithmVersion ?? GATES_ALGORITHM_VERSION;
}

function resolvePersonJobScore(input: GateEvalInput): number {
  if (input.personScoringFeatures) {
    return computePersonJobScore(input.personScoringFeatures);
  }
  if (input.personJobScore == null) {
    throw new Error('personJobScore or personScoringFeatures is required');
  }
  return input.personJobScore;
}

function resolveAddressIdentityScore(input: GateEvalInput): number {
  if (input.addressScoringFeatures) {
    return computeAddressIdentityScore(input.addressScoringFeatures);
  }
  if (input.addressIdentityScore == null) {
    throw new Error('addressIdentityScore or addressScoringFeatures is required');
  }
  return input.addressIdentityScore;
}

function isInvitedChannelPath(input: GateEvalInput): boolean {
  const ch = input.invitedChannel;
  return Boolean(ch?.address?.trim() && ch.inSourceText);
}

function makeDecision(
  gate: GateName,
  score: number,
  threshold: number,
  passed: boolean,
  reason: string,
  algorithmVersion: string,
  inputsSummary: GateDecision['inputsSummary'],
): GateDecision {
  return {
    gate,
    score,
    threshold,
    passed,
    reason,
    algorithmVersion,
    inputsSummary,
  };
}

function thresholdPass(score: number, threshold: number): boolean {
  return score >= threshold;
}

export function evaluateGates(input: GateEvalInput): GateEvalResult {
  const thresholds = { ...GATE_THRESHOLDS, ...input.thresholds };
  const algorithmVersion = resolveVersion(input);
  const invitedPath = isInvitedChannelPath(input);
  const policyInferred = input.inferredAddressPolicyEnabled === true;
  const verificationCapExceeded = input.verificationAttemptCount >= 2;
  const inferredBlocked = input.addressProvenance === 'inferred' && !policyInferred;

  const shortlistEligible =
    thresholdPass(input.jobTrustScore, thresholds.jobTrust) &&
    thresholdPass(input.jobMatchScore, thresholds.jobMatch);

  const personScore = invitedPath ? 0 : resolvePersonJobScore(input);
  const addressScore = invitedPath ? 0 : resolveAddressIdentityScore(input);

  const decisions: GateDecision[] = [];

  const jobTrustPass = thresholdPass(input.jobTrustScore, thresholds.jobTrust);
  decisions.push(
    makeDecision(
      'jobTrust',
      input.jobTrustScore,
      thresholds.jobTrust,
      jobTrustPass,
      jobTrustPass ? 'job_trust_ok' : 'job_trust_below_threshold',
      algorithmVersion,
      { score: input.jobTrustScore },
    ),
  );

  const jobMatchPass = thresholdPass(input.jobMatchScore, thresholds.jobMatch);
  decisions.push(
    makeDecision(
      'jobMatch',
      input.jobMatchScore,
      thresholds.jobMatch,
      jobMatchPass,
      jobMatchPass ? 'job_match_ok' : 'job_match_below_threshold',
      algorithmVersion,
      { score: input.jobMatchScore },
    ),
  );

  if (invitedPath) {
    decisions.push(
      makeDecision(
        'personJob',
        personScore,
        thresholds.personJob,
        true,
        'skipped_invited_channel',
        algorithmVersion,
        { invited: true, address: input.invitedChannel!.address },
      ),
      makeDecision(
        'addressIdentity',
        addressScore,
        thresholds.addressIdentity,
        true,
        'skipped_invited_channel',
        algorithmVersion,
        { invited: true, address: input.invitedChannel!.address },
      ),
    );
  } else {
    const personPass = thresholdPass(personScore, thresholds.personJob);
    decisions.push(
      makeDecision(
        'personJob',
        personScore,
        thresholds.personJob,
        personPass,
        personPass ? 'person_job_ok' : 'person_job_below_threshold',
        algorithmVersion,
        { score: personScore, fromFeatures: Boolean(input.personScoringFeatures) },
      ),
    );

    const addressPass = thresholdPass(addressScore, thresholds.addressIdentity);
    decisions.push(
      makeDecision(
        'addressIdentity',
        addressScore,
        thresholds.addressIdentity,
        addressPass,
        addressPass ? 'address_identity_ok' : 'address_identity_below_threshold',
        algorithmVersion,
        {
          score: addressScore,
          provenance: input.addressProvenance,
          fromFeatures: Boolean(input.addressScoringFeatures),
        },
      ),
    );
  }

  let mailboxPass = thresholdPass(input.mailboxConfidenceScore, thresholds.mailboxConfidence);
  let mailboxReason = mailboxPass ? 'mailbox_confidence_ok' : 'mailbox_below_threshold';

  if (input.mailboxStatus === 'unknown') {
    mailboxPass = false;
    mailboxReason = 'mailbox_status_unknown';
  } else if (input.mailboxStatus === 'accept_all' && !invitedPath) {
    mailboxPass = false;
    mailboxReason = 'mailbox_accept_all_not_invited';
  } else if (input.mailboxStatus === 'invalid' || input.mailboxStatus === 'disposable') {
    mailboxPass = false;
    mailboxReason = `mailbox_status_${input.mailboxStatus}`;
  }

  decisions.push(
    makeDecision(
      'mailboxConfidence',
      input.mailboxConfidenceScore,
      thresholds.mailboxConfidence,
      mailboxPass,
      mailboxReason,
      algorithmVersion,
      {
        score: input.mailboxConfidenceScore,
        status: input.mailboxStatus,
        invitedPath,
      },
    ),
  );

  const applicablePasses = decisions.filter((d) => d.reason !== 'skipped_invited_channel');
  let overallPass = applicablePasses.every((d) => d.passed);

  let skipReason: string | undefined;
  if (inferredBlocked) {
    overallPass = false;
    skipReason = 'inferred_address_ineligible';
  } else if (verificationCapExceeded) {
    overallPass = false;
    skipReason = 'verification_attempt_cap';
  } else {
    const firstFailure = applicablePasses.find((d) => !d.passed);
    if (!overallPass && firstFailure) {
      skipReason = firstFailure.reason;
    }
  }

  return {
    overallPass,
    decisions,
    skipReason,
    shortlistEligible,
  };
}
