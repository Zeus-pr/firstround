import { assertTransition, type CampaignSnapshot } from '@/lib/campaign/transitions';
import type { CampaignState } from '@/lib/campaign/states';

export type TransitionRequest = {
  from: CampaignState;
  to: CampaignState;
  actor: string;
  reason: string;
  policyVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
  meta?: Record<string, unknown>;
};

export type TransitionRecord = TransitionRequest & {
  at: string;
};

/**
 * In-memory campaign state machine for simulation and unit tests.
 * Postgres enforces the same edges via application code before writing transitions.
 */
export class CampaignMachine {
  private state: CampaignState;
  private readonly history: TransitionRecord[] = [];
  private initialSendConfirmed = false;
  private creditDebited = false;
  private draftHashAtApproval: string | null = null;
  private draftHashAtSend: string | null = null;
  private suppressedRecipient = false;

  constructor(initial: CampaignState = 'drafted') {
    this.state = initial;
  }

  getState(): CampaignState {
    return this.state;
  }

  getHistory(): readonly TransitionRecord[] {
    return this.history;
  }

  setDraftHashAtApproval(hash: string) {
    this.draftHashAtApproval = hash;
  }

  setSuppressedRecipient(value: boolean) {
    this.suppressedRecipient = value;
  }

  apply(request: TransitionRequest): TransitionRecord {
    assertTransition(request.from, request.to);
    if (request.from !== this.state) {
      throw new Error(`Machine is in ${this.state}, not ${request.from}`);
    }

    if (request.to === 'approved' && typeof request.meta?.draftHash === 'string') {
      this.draftHashAtApproval = request.meta.draftHash;
    }

    if (request.to === 'sent') {
      if (this.suppressedRecipient) {
        throw new Error('Cannot confirm send to a suppressed recipient');
      }
      const sendHash =
        typeof request.meta?.draftHash === 'string'
          ? request.meta.draftHash
          : this.draftHashAtApproval;
      if (this.draftHashAtApproval && sendHash && this.draftHashAtApproval !== sendHash) {
        throw new Error('Draft hash at send does not match approval');
      }
      this.draftHashAtSend = sendHash ?? null;
      this.initialSendConfirmed = true;
      this.creditDebited = true;
    }

    this.state = request.to;
    const record: TransitionRecord = {
      ...request,
      at: new Date().toISOString(),
    };
    this.history.push(record);
    return record;
  }

  snapshot(): CampaignSnapshot {
    return {
      state: this.state,
      initialSendConfirmed: this.initialSendConfirmed,
      creditDebited: this.creditDebited,
      draftHashAtApproval: this.draftHashAtApproval,
      draftHashAtSend: this.draftHashAtSend,
      suppressedRecipient: this.suppressedRecipient,
    };
  }
}
