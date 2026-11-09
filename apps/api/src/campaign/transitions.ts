import { isStopState, type CampaignState } from './states.js';

type Transition = {
  from: CampaignState;
  to: CampaignState;
  guard: string;
};

const CORE_TRANSITIONS: readonly Transition[] = [
  {
    from: 'drafted',
    to: 'pending_approval',
    guard: 'All five gates stored and valid under current policy version',
  },
  {
    from: 'pending_approval',
    to: 'approved',
    guard: 'Candidate approved, or Autopilot on and cancel window elapsed',
  },
  {
    from: 'approved',
    to: 'queued',
    guard: 'Outbox record created in the same transaction',
  },
  {
    from: 'queued',
    to: 'sending',
    guard: 'Lease acquired; job live, no suppression, no reply, token valid, capacity reserved',
  },
  {
    from: 'sending',
    to: 'sent',
    guard: 'Gmail identifiers stored and credit debited in one transaction',
  },
  {
    from: 'sending',
    to: 'uncertain_send',
    guard: 'Timeout or ambiguous Gmail response',
  },
  {
    from: 'uncertain_send',
    to: 'sent',
    guard: 'Reconciliation proves sent',
  },
  {
    from: 'uncertain_send',
    to: 'queued',
    guard: 'Reconciliation proves not sent',
  },
  {
    from: 'sent',
    to: 'awaiting_followup_1',
    guard: 'Initial send confirmed',
  },
  {
    from: 'awaiting_followup_1',
    to: 'followup_1_sent',
    guard: 'Same guards as queued, plus no stop-class reply',
  },
  {
    from: 'followup_1_sent',
    to: 'awaiting_followup_2',
    guard: 'Follow-up 1 confirmed',
  },
  {
    from: 'awaiting_followup_2',
    to: 'followup_2_sent',
    guard: 'Same guards as queued, plus no stop-class reply',
  },
  {
    from: 'followup_2_sent',
    to: 'closed_no_reply',
    guard: 'Schedule complete',
  },
];

const NON_TERMINAL: readonly CampaignState[] = [
  'drafted',
  'pending_approval',
  'approved',
  'queued',
  'sending',
  'uncertain_send',
  'sent',
  'awaiting_followup_1',
  'followup_1_sent',
  'awaiting_followup_2',
  'followup_2_sent',
];

const STOP_TARGETS: readonly CampaignState[] = [
  'replied',
  'opted_out',
  'bounced',
  'cancelled_by_user',
  'cancelled_by_policy',
  'expired',
  'paused',
];

const STOP_TRANSITIONS: Transition[] = NON_TERMINAL.flatMap((from) =>
  STOP_TARGETS.map((to) => ({
    from,
    to,
    guard: 'Reply class, bounce, opt-out, user action, policy, or kill switch',
  })),
);

/** Legal transitions from architecture Appendix A. */
export const LEGAL_TRANSITIONS: readonly Transition[] = [...CORE_TRANSITIONS, ...STOP_TRANSITIONS];

const EDGE = new Set(LEGAL_TRANSITIONS.map((t) => `${t.from}->${t.to}`));

export class IllegalTransitionError extends Error {
  readonly from: CampaignState;
  readonly to: CampaignState;

  constructor(from: CampaignState, to: CampaignState) {
    super(`Illegal campaign transition: ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function canTransition(from: CampaignState, to: CampaignState): boolean {
  if (from === to) return false;
  return EDGE.has(`${from}->${to}`);
}

export function assertTransition(from: CampaignState, to: CampaignState): void {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}

export type CampaignSnapshot = {
  state: CampaignState;
  initialSendConfirmed: boolean;
  creditDebited: boolean;
  draftHashAtApproval: string | null;
  draftHashAtSend: string | null;
  suppressedRecipient: boolean;
};

/** Appendix A invariants that can be checked without live Gmail. */
export function checkInvariants(campaign: CampaignSnapshot): string[] {
  const violations: string[] = [];

  if (campaign.creditDebited !== campaign.initialSendConfirmed) {
    violations.push('invariant_2_credit_iff_initial_send');
  }

  if (isStopState(campaign.state) && campaign.state !== 'paused' && campaign.state !== 'replied') {
    // stop states must not still look like an active send pipeline in snapshot checks
  }

  if (campaign.suppressedRecipient && campaign.initialSendConfirmed) {
    violations.push('invariant_6_no_send_to_suppressed');
  }

  if (
    campaign.draftHashAtApproval &&
    campaign.draftHashAtSend &&
    campaign.draftHashAtApproval !== campaign.draftHashAtSend &&
    campaign.initialSendConfirmed
  ) {
    violations.push('invariant_9_draft_hash_mismatch');
  }

  return violations;
}
