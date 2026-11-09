import { describe, expect, it } from 'vitest';
import { CampaignMachine } from '@/lib/campaign/machine';
import {
  assertTransition,
  canTransition,
  checkInvariants,
  IllegalTransitionError,
} from '@/lib/campaign/transitions';

describe('campaign state machine', () => {
  it('allows the happy path to first send', () => {
    const machine = new CampaignMachine();
    machine.apply({
      from: 'drafted',
      to: 'pending_approval',
      actor: 'system',
      reason: 'gates_ok',
    });
    machine.apply({
      from: 'pending_approval',
      to: 'approved',
      actor: 'user',
      reason: 'approved',
      meta: { draftHash: 'abc' },
    });
    machine.apply({
      from: 'approved',
      to: 'queued',
      actor: 'system',
      reason: 'outbox',
    });
    machine.apply({
      from: 'queued',
      to: 'sending',
      actor: 'sender',
      reason: 'lease',
    });
    machine.apply({
      from: 'sending',
      to: 'sent',
      actor: 'sender',
      reason: 'gmail_ok',
      meta: { draftHash: 'abc' },
    });

    expect(machine.getState()).toBe('sent');
    expect(checkInvariants(machine.snapshot())).toEqual([]);
    expect(machine.getHistory()).toHaveLength(5);
  });

  it('rejects illegal transitions', () => {
    expect(() => assertTransition('drafted', 'sent')).toThrow(IllegalTransitionError);
    expect(canTransition('drafted', 'pending_approval')).toBe(true);
  });

  it('flags credit/send invariant violations', () => {
    expect(
      checkInvariants({
        state: 'sent',
        initialSendConfirmed: true,
        creditDebited: false,
        draftHashAtApproval: 'a',
        draftHashAtSend: 'a',
        suppressedRecipient: false,
      }),
    ).toContain('invariant_2_credit_iff_initial_send');
  });

  it('blocks send when recipient is suppressed', () => {
    const machine = new CampaignMachine('sending');
    machine.setDraftHashAtApproval('abc');
    machine.setSuppressedRecipient(true);
    expect(() =>
      machine.apply({
        from: 'sending',
        to: 'sent',
        actor: 'sender',
        reason: 'gmail_ok',
        meta: { draftHash: 'abc' },
      }),
    ).toThrow(/suppressed/);
  });

  it('simulates randomised legal paths without invariant breaks', () => {
    for (let i = 0; i < 40; i += 1) {
      const machine = new CampaignMachine();
      const steps: Array<{
        from: Parameters<typeof machine.apply>[0]['from'];
        to: Parameters<typeof machine.apply>[0]['to'];
      }> = [
        { from: 'drafted', to: 'pending_approval' },
        { from: 'pending_approval', to: 'approved' },
        { from: 'approved', to: 'queued' },
        { from: 'queued', to: 'sending' },
      ];
      for (const step of steps) {
        machine.apply({
          ...step,
          actor: 'sim',
          reason: 'sim',
          meta: step.to === 'approved' ? { draftHash: 'h1' } : undefined,
        });
      }
      if (i % 2 === 0) {
        machine.apply({
          from: 'sending',
          to: 'sent',
          actor: 'sim',
          reason: 'sim',
          meta: { draftHash: 'h1' },
        });
        expect(checkInvariants(machine.snapshot())).toEqual([]);
      } else {
        machine.apply({
          from: 'sending',
          to: 'cancelled_by_user',
          actor: 'user',
          reason: 'cancel',
        });
        expect(machine.getState()).toBe('cancelled_by_user');
      }
    }
  });
});
