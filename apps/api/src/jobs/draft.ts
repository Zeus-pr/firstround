import { createHash } from 'node:crypto';

export const DRAFT_SPECIFICITY_MINIMUM = 85;
export const DRAFT_ALGORITHM_VERSION = 'draft-guard-1';

export type DraftEvidence = {
  company: string;
  role: string;
  person: string;
  evidenceFacts: string[];
  /** Employers from the CV that the letter may name. */
  priorCompanies?: string[];
};

export type StoredDraft = {
  campaignId: string;
  body: string;
  status: 'pending_approval' | 'approved' | 'expired' | 'rejected';
  draftHash: string | null;
  specificity: number;
  evidence: DraftEvidence;
  jobCanonicalId: string;
  recipientEmail: string;
  personName: string;
};

export function normalizeDraftBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

export function hashDraftBody(body: string): string {
  return createHash('sha256').update(normalizeDraftBody(body), 'utf8').digest('hex');
}

/**
 * Specificity: how much of the body is grounded in evidence tokens.
 * Blocks approval below 85.
 */
export function scoreSpecificity(body: string, evidence: DraftEvidence): number {
  const text = normalizeDraftBody(body).toLowerCase();
  if (!text) return 0;
  const tokens = [evidence.company, evidence.role, evidence.person, ...evidence.evidenceFacts]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const token of tokens) {
    if (text.includes(token)) hits += 1;
  }
  const coverage = hits / tokens.length;
  const lengthBonus = Math.min(normalizeDraftBody(body).length / 400, 1) * 15;
  return Math.max(0, Math.min(100, Math.round(coverage * 85 + lengthBonus)));
}

export function validateDraftBody(
  body: string,
  evidence: DraftEvidence,
): { ok: true; specificity: number } | { ok: false; reason: string; specificity: number } {
  const normalized = normalizeDraftBody(body);
  if (normalized.length < 40) {
    return { ok: false, reason: 'Draft body is too short', specificity: 0 };
  }
  const company = evidence.company.trim().toLowerCase();
  if (company) {
    const companyMentioned = normalized.toLowerCase().includes(company);
    // CV bullets are evidence. Only scan the letter outside those bullets for invented employers.
    let outsideEvidence = normalized.toLowerCase();
    for (const fact of evidence.evidenceFacts) {
      const token = fact.trim().toLowerCase();
      if (token) outsideEvidence = outsideEvidence.replaceAll(token, ' ');
    }
    const allowed = [
      company,
      ...(evidence.priorCompanies ?? []).map((c) => c.toLowerCase()),
    ].filter(Boolean);
    const knownCompany = (named: string) =>
      allowed.some((a) => a === named || a.includes(named) || named.includes(a));
    const otherCompanies = outsideEvidence.match(/\b(?:at|join)\s+([a-z0-9][a-z0-9&.\- ]{1,60})/g);
    if (otherCompanies) {
      for (const phrase of otherCompanies) {
        const named = phrase
          .replace(/^(at|join)\s+/i, '')
          .trim()
          .toLowerCase();
        if (named && !knownCompany(named)) {
          return {
            ok: false,
            reason: `Body names company "${named}" which is absent from evidence`,
            specificity: scoreSpecificity(normalized, evidence),
          };
        }
      }
    }
    if (!companyMentioned) {
      // Allow if evidence company is multi-word and a significant token appears.
      const parts = company.split(/\s+/).filter((p) => p.length > 3);
      const anyPart = parts.some((p) => normalized.toLowerCase().includes(p));
      if (!anyPart) {
        return {
          ok: false,
          reason: `Body must reference evidence company "${evidence.company}"`,
          specificity: scoreSpecificity(normalized, evidence),
        };
      }
    }
  }
  const specificity = scoreSpecificity(normalized, evidence);
  if (specificity < DRAFT_SPECIFICITY_MINIMUM) {
    return {
      ok: false,
      reason: `Specificity ${specificity} is below ${DRAFT_SPECIFICITY_MINIMUM}`,
      specificity,
    };
  }
  return { ok: true, specificity };
}

/** Editor may change body only; job/person/address from the client are ignored. */
export function mergeEditorInput(
  stored: StoredDraft,
  input: {
    body?: string;
    jobCanonicalId?: string;
    recipientEmail?: string;
    personName?: string;
  },
): StoredDraft {
  return {
    ...stored,
    body: typeof input.body === 'string' ? input.body : stored.body,
    // Ignore client attempts to swap job/person/address.
    jobCanonicalId: stored.jobCanonicalId,
    recipientEmail: stored.recipientEmail,
    personName: stored.personName,
  };
}

export function approveDraft(
  stored: StoredDraft,
  input: { body?: string; jobCanonicalId?: string; recipientEmail?: string; personName?: string },
):
  | { ok: true; draft: StoredDraft; idempotent: boolean }
  | { ok: false; reason: string; specificity: number } {
  if (stored.status === 'approved' && stored.draftHash) {
    return { ok: true, draft: stored, idempotent: true };
  }
  if (stored.status === 'expired') {
    return { ok: false, reason: 'Draft expired at cutoff', specificity: stored.specificity };
  }
  const merged = mergeEditorInput(stored, input);
  const validated = validateDraftBody(merged.body, merged.evidence);
  if (!validated.ok) {
    return { ok: false, reason: validated.reason, specificity: validated.specificity };
  }
  const draftHash = hashDraftBody(merged.body);
  return {
    ok: true,
    idempotent: false,
    draft: {
      ...merged,
      body: normalizeDraftBody(merged.body),
      specificity: validated.specificity,
      draftHash,
      status: 'approved',
    },
  };
}

export function expirePendingAtCutoff<T extends { status: string; expiresAt?: Date | null }>(
  drafts: T[],
  now: Date,
): T[] {
  return drafts.map((d) => {
    if (d.status !== 'pending_approval') return d;
    if (d.expiresAt && d.expiresAt.getTime() <= now.getTime()) {
      return { ...d, status: 'expired' };
    }
    return d;
  });
}
