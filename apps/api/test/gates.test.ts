import { describe, expect, it } from 'vitest';
import {
  GATE_THRESHOLDS,
  GATES_ALGORITHM_VERSION,
  computeAddressIdentityScore,
  computePersonJobScore,
  evaluateGates,
  evaluateHardFilters,
  type GateEvalInput,
} from '../src/jobs/gates.js';

function passingOwnerPathInput(overrides: Partial<GateEvalInput> = {}): GateEvalInput {
  return {
    jobTrustScore: 82,
    jobMatchScore: 88,
    personJobScore: 85,
    addressIdentityScore: 80,
    mailboxConfidenceScore: 92,
    mailboxStatus: 'valid',
    addressProvenance: 'published-with-url',
    verificationAttemptCount: 0,
    ...overrides,
  };
}

describe('GATE_THRESHOLDS', () => {
  it('matches launch defaults from architecture', () => {
    expect(GATE_THRESHOLDS).toEqual({
      jobTrust: 75,
      jobMatch: 78,
      personJob: 80,
      addressIdentity: 75,
      mailboxConfidence: 90,
    });
  });
});

describe('evaluateHardFilters', () => {
  const prefsBase = {
    workAuthorization: 'india_citizen',
    targetLevel: 'senior',
    locations: ['bengaluru', 'remote'],
    remoteOk: true,
  };

  const jobBase = {
    workAuthorizationRequired: 'india_citizen',
    seniorityLevel: 'senior',
    location: 'Bengaluru',
    workMode: 'onsite' as const,
    closed: false,
  };

  it('excludes when work authorization is missing on preferences', () => {
    const result = evaluateHardFilters({ ...prefsBase, workAuthorization: null }, jobBase);
    expect(result).toEqual({
      ok: false,
      reason: 'missing_work_authorization_on_preferences',
    });
  });

  it('excludes on seniority materially outside preference', () => {
    const result = evaluateHardFilters(
      { ...prefsBase, targetLevel: 'junior' },
      { ...jobBase, seniorityLevel: 'director' },
    );
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: 'seniority_outside_preference' });
  });

  it('excludes on location conflict', () => {
    const result = evaluateHardFilters(
      { ...prefsBase, locations: ['mumbai'], remoteOk: false },
      { ...jobBase, location: 'Chennai', workMode: 'onsite' },
    );
    expect(result).toEqual({
      ok: false,
      reason: 'location_conflict_with_preferences',
    });
  });

  it('allows remote jobs without a location match', () => {
    const result = evaluateHardFilters(prefsBase, {
      ...jobBase,
      workMode: 'remote',
      location: 'Anywhere',
    });
    expect(result).toEqual({ ok: true });
  });
});

describe('evaluateGates — independence (AE2)', () => {
  it('fails overall when match is strong but mailbox is one point below threshold', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        jobMatchScore: 90,
        mailboxConfidenceScore: 89,
      }),
    );

    expect(result.overallPass).toBe(false);
    expect(result.skipReason).toBe('mailbox_below_threshold');
    const mailbox = result.decisions.find((d) => d.gate === 'mailboxConfidence');
    expect(mailbox?.passed).toBe(false);
    expect(mailbox?.score).toBe(89);
    expect(mailbox?.threshold).toBe(90);
    const jobMatch = result.decisions.find((d) => d.gate === 'jobMatch');
    expect(jobMatch?.passed).toBe(true);
    expect(result.decisions).toHaveLength(5);
  });

  it('fails when one gate is weak even if others are very strong', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        jobTrustScore: 99,
        jobMatchScore: 99,
        personJobScore: 99,
        addressIdentityScore: 74,
        mailboxConfidenceScore: 99,
      }),
    );
    expect(result.overallPass).toBe(false);
    expect(result.skipReason).toBe('address_identity_below_threshold');
  });
});

describe('evaluateGates — invited channel', () => {
  it('skips person and address gates but still requires mailbox confidence', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        personJobScore: 40,
        addressIdentityScore: 40,
        invitedChannel: {
          address: 'careers@acme.in',
          inSourceText: true,
        },
      }),
    );
    const person = result.decisions.find((d) => d.gate === 'personJob');
    const address = result.decisions.find((d) => d.gate === 'addressIdentity');
    expect(person?.reason).toBe('skipped_invited_channel');
    expect(address?.reason).toBe('skipped_invited_channel');
    expect(person?.passed).toBe(true);
    expect(result.overallPass).toBe(true);
  });

  it('fails on unknown mailbox even on invited channel', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        mailboxStatus: 'unknown',
        mailboxConfidenceScore: 95,
        invitedChannel: {
          address: 'hr@acme.in',
          inSourceText: true,
        },
      }),
    );
    expect(result.overallPass).toBe(false);
    expect(result.skipReason).toBe('mailbox_status_unknown');
  });

  it('allows accept_all on invited channel when score passes', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        mailboxStatus: 'accept_all',
        mailboxConfidenceScore: 91,
        invitedChannel: {
          address: 'jobs@acme.in',
          inSourceText: true,
        },
      }),
    );
    const mailbox = result.decisions.find((d) => d.gate === 'mailboxConfidence');
    expect(mailbox?.passed).toBe(true);
    expect(result.overallPass).toBe(true);
  });

  it('rejects accept_all off invited channel', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        mailboxStatus: 'accept_all',
        mailboxConfidenceScore: 95,
      }),
    );
    expect(result.overallPass).toBe(false);
    expect(result.skipReason).toBe('mailbox_accept_all_not_invited');
  });
});

describe('evaluateGates — inferred address policy', () => {
  it('blocks inferred provenance while policy flag is off', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        addressProvenance: 'inferred',
        inferredAddressPolicyEnabled: false,
      }),
    );
    expect(result.overallPass).toBe(false);
    expect(result.skipReason).toBe('inferred_address_ineligible');
  });

  it('allows inferred provenance when policy flag is on', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        addressProvenance: 'inferred',
        inferredAddressPolicyEnabled: true,
      }),
    );
    expect(result.overallPass).toBe(true);
  });
});

describe('evaluateGates — verification cap', () => {
  it('refuses a third verification attempt for the same job', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        verificationAttemptCount: 2,
      }),
    );
    expect(result.overallPass).toBe(false);
    expect(result.skipReason).toBe('verification_attempt_cap');
  });

  it('still evaluates when only one prior attempt', () => {
    const result = evaluateGates(
      passingOwnerPathInput({
        verificationAttemptCount: 1,
      }),
    );
    expect(result.overallPass).toBe(true);
    expect(result.skipReason).toBeUndefined();
  });
});

describe('FairnessGuard person and address scoring', () => {
  const personFeatures = {
    displayName: 'Asha Rao',
    listedOnJob: true,
    titleMatch: 88,
    teamAlignment: 80,
    sourceQuality: 75,
    conflictSignals: 5,
    employmentFresh: true,
  };

  const addressFeatures = {
    displayName: 'Asha Rao',
    directPublicTie: 85,
    patternSupport: 60,
    localPartCorrespondence: 70,
    corporateDomainMatch: true,
    employmentCurrent: true,
  };

  it('ignores display name when scoring person-job fit', () => {
    const a = computePersonJobScore(personFeatures);
    const b = computePersonJobScore({
      ...personFeatures,
      displayName: "James O'Connor",
    });
    expect(a).toBe(b);
  });

  it('ignores display name when scoring address identity', () => {
    const a = computeAddressIdentityScore(addressFeatures);
    const b = computeAddressIdentityScore({
      ...addressFeatures,
      displayName: 'Priya Nair',
    });
    expect(a).toBe(b);
  });

  it('derives gate scores from features in evaluateGates', () => {
    const features = {
      ...personFeatures,
      displayName: 'Name A',
    };
    const featuresAlt = {
      ...personFeatures,
      displayName: 'Name B',
    };
    const r1 = evaluateGates(
      passingOwnerPathInput({
        personScoringFeatures: features,
        addressScoringFeatures: addressFeatures,
        personJobScore: undefined,
        addressIdentityScore: 80,
      }),
    );
    const r2 = evaluateGates(
      passingOwnerPathInput({
        personScoringFeatures: featuresAlt,
        addressScoringFeatures: { ...addressFeatures, displayName: 'Other' },
        personJobScore: undefined,
        addressIdentityScore: 80,
      }),
    );
    const p1 = r1.decisions.find((d) => d.gate === 'personJob')?.score;
    const p2 = r2.decisions.find((d) => d.gate === 'personJob')?.score;
    expect(p1).toBe(p2);
  });
});

describe('stored decision shape', () => {
  it('includes version, threshold, and inputs summary on every gate', () => {
    const result = evaluateGates(passingOwnerPathInput());
    for (const d of result.decisions) {
      expect(d.algorithmVersion).toBe(GATES_ALGORITHM_VERSION);
      expect(d.threshold).toBe(GATE_THRESHOLDS[d.gate]);
      expect(typeof d.reason).toBe('string');
      expect(d.inputsSummary).toBeTypeOf('object');
    }
    expect(result.shortlistEligible).toBe(true);
  });
});

describe('deterministic shortlist eligibility', () => {
  it('marks shortlist ineligible when job match is under 78', () => {
    const result = evaluateGates(passingOwnerPathInput({ jobMatchScore: 77, jobTrustScore: 90 }));
    expect(result.shortlistEligible).toBe(false);
  });
});
