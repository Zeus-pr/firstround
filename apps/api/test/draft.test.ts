import { describe, expect, it } from 'vitest';
import {
  approveDraft,
  expirePendingAtCutoff,
  hashDraftBody,
  mergeEditorInput,
  scoreSpecificity,
  validateDraftBody,
  type StoredDraft,
} from '../src/jobs/draft.js';

const evidence = {
  company: 'Acme Labs',
  role: 'Backend Engineer',
  person: 'Priya Sharma',
  evidenceFacts: ['Postgres', 'Bengaluru platform team', 'Node services'],
};

function baseDraft(over: Partial<StoredDraft> = {}): StoredDraft {
  return {
    campaignId: 'c1',
    body: '',
    status: 'pending_approval',
    draftHash: null,
    specificity: 0,
    evidence,
    jobCanonicalId: 'job-1',
    recipientEmail: 'priya@acme.com',
    personName: 'Priya Sharma',
    ...over,
  };
}

const goodBody =
  'Hi Priya Sharma — I am reaching out about the Backend Engineer role at Acme Labs on the Bengaluru platform team. I have shipped Node services on Postgres and would value a brief conversation.';

describe('draft guard', () => {
  it('does not treat words inside a CV bullet as an invented employer', () => {
    const bullet = 'Closed the gap at East India against a live revenue target.';
    const result = validateDraftBody(`${goodBody} ${bullet}`, {
      ...evidence,
      evidenceFacts: [...evidence.evidenceFacts, bullet],
    });
    expect(result.ok).toBe(true);
  });

  it('allows a prior employer named in the CV', () => {
    const result = validateDraftBody(`${goodBody} I did this work at Samsung Electronics.`, {
      ...evidence,
      priorCompanies: ['Samsung Electronics'],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a body that invents another company', () => {
    const result = validateDraftBody(
      'Hi — please join Globex Corporation as Backend Engineer with Postgres in Bengaluru.',
      evidence,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/absent from evidence|must reference/i);
  });

  it('ignores client attempts to change recipient or job', () => {
    const stored = baseDraft({ body: goodBody });
    const merged = mergeEditorInput(stored, {
      body: goodBody,
      recipientEmail: 'attacker@evil.test',
      jobCanonicalId: 'other-job',
      personName: 'Other Person',
    });
    expect(merged.recipientEmail).toBe('priya@acme.com');
    expect(merged.jobCanonicalId).toBe('job-1');
    expect(merged.personName).toBe('Priya Sharma');
  });

  it('blocks low specificity', () => {
    const result = validateDraftBody('Hello there, hope you are well.', evidence);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.specificity).toBeLessThan(85);
  });

  it('approves a grounded body and is idempotent on second approve', () => {
    const first = approveDraft(baseDraft(), { body: goodBody });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.draft.draftHash).toBe(hashDraftBody(goodBody));
    expect(first.draft.specificity).toBeGreaterThanOrEqual(85);
    const second = approveDraft(first.draft, { body: goodBody + ' extra' });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotent).toBe(true);
    expect(second.draft.draftHash).toBe(first.draft.draftHash);
  });

  it('expires pending drafts at cutoff', () => {
    const now = new Date('2026-11-10T18:00:00Z');
    const out = expirePendingAtCutoff(
      [
        { status: 'pending_approval', expiresAt: new Date('2026-11-10T17:00:00Z') },
        { status: 'pending_approval', expiresAt: new Date('2026-11-10T19:00:00Z') },
        { status: 'approved', expiresAt: new Date('2026-11-10T17:00:00Z') },
      ],
      now,
    );
    expect(out.at(0)?.status).toBe('expired');
    expect(out.at(1)?.status).toBe('pending_approval');
    expect(out.at(2)?.status).toBe('approved');
  });

  it('scores specificity higher when evidence tokens appear', () => {
    expect(scoreSpecificity(goodBody, evidence)).toBeGreaterThan(
      scoreSpecificity('Hello friend', evidence),
    );
  });
});
