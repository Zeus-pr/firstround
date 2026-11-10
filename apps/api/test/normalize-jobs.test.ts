import { describe, expect, it } from 'vitest';
import {
  fingerprintJob,
  normalizeProviderJob,
  parseInvitedEmail,
  scoreJobTrust,
} from '../src/jobs/normalize.js';
import { assertSourceRunnable, isSourceRunnable } from '../src/jobs/source-register.js';
import { actorForSource, buildActorInput } from '../src/jobs/apify.js';

describe('job normalize + trust', () => {
  const base = {
    id: 'jp-1',
    job_title: 'Backend Engineer',
    company: 'Acme Labs',
    company_domain: 'acme.com',
    url: 'https://www.naukri.com/job/1',
    location: 'Bengaluru',
    date_posted: new Date().toISOString().slice(0, 10),
    description:
      'We need a backend engineer for our platform team in Bengaluru. Requirements include Node, Postgres, and systems design. Apply via the company careers page.',
    skills: ['Node', 'Postgres'],
    seniority: 'mid',
    work_arrangement: 'hybrid',
  };

  it('normalizes a JobsPipe-shaped row and scores trust above quarantine', () => {
    const job = normalizeProviderJob(base);
    expect(job).not.toBeNull();
    expect(job!.companyDomain).toBe('acme.com');
    expect(job!.fingerprint).toHaveLength(64);
    const trust = scoreJobTrust(job!, 'naukri_apify');
    expect(trust.score).toBeGreaterThanOrEqual(75);
    expect(trust.quarantined).toBe(false);
  });

  it('dedupes identical company/title/location/description fingerprints', () => {
    const a = normalizeProviderJob(base)!;
    const b = normalizeProviderJob({ ...base, id: 'jp-2' })!;
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('parses obfuscated invited emails strictly', () => {
    const parsed = parseInvitedEmail('Send CV to hiring [at] acme [dot] com today');
    expect(parsed?.email).toBe('hiring@acme.com');
  });

  it('quarantines fraud-pattern descriptions', () => {
    const job = normalizeProviderJob({
      ...base,
      description: 'Pay to apply and send bitcoin wallet details before interview.',
    })!;
    const trust = scoreJobTrust(job, 'naukri_apify');
    expect(trust.breakdown.fraudRiskAbsence).toBe(0);
    expect(trust.quarantined).toBe(true);
  });

  it('fingerprint helper is stable', () => {
    const fp = fingerprintJob({
      companyDomain: 'acme.com',
      companyName: 'Acme',
      normalizedTitle: null,
      title: 'Engineer',
      location: 'Pune',
      descriptionText: 'Build APIs',
    });
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('source register gate', () => {
  it('blocks missing, kill-switched, disabled, or pending counsel sources', () => {
    expect(isSourceRunnable(null)).toBe(false);
    expect(() =>
      assertSourceRunnable({
        sourceKey: 'naukri_apify',
        enabled: true,
        killSwitch: true,
        legalStatus: 'pilot_operator_accepted',
      }),
    ).toThrow(/kill-switched/);
    expect(
      isSourceRunnable({
        sourceKey: 'naukri_apify',
        enabled: false,
        killSwitch: false,
        legalStatus: 'pilot_operator_accepted',
      }),
    ).toBe(false);
    expect(
      isSourceRunnable({
        sourceKey: 'naukri_apify',
        enabled: true,
        killSwitch: false,
        legalStatus: 'pending_counsel',
      }),
    ).toBe(false);
    expect(
      isSourceRunnable({
        sourceKey: 'naukri_apify',
        enabled: true,
        killSwitch: false,
        legalStatus: 'pilot_operator_accepted',
      }),
    ).toBe(true);
  });
});

describe('apify source mapping', () => {
  it('maps naukri and linkedin actors and inputs', () => {
    expect(actorForSource('naukri_apify')).toContain('naukri');
    expect(actorForSource('linkedin_apify')).toContain('jobspipe');
    expect(buildActorInput('naukri_apify', { keywords: 'java developer' }).keywords).toBe(
      'java developer',
    );
    expect(buildActorInput('linkedin_apify', { keywords: 'product manager' }).sources).toEqual([
      'linkedin',
    ]);
  });
});
