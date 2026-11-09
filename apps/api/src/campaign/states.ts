export const CAMPAIGN_STATES = [
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
  'closed_no_reply',
  'replied',
  'opted_out',
  'bounced',
  'cancelled_by_user',
  'cancelled_by_policy',
  'expired',
  'paused',
] as const;

export type CampaignState = (typeof CAMPAIGN_STATES)[number];

export const STOP_STATES = [
  'replied',
  'opted_out',
  'bounced',
  'cancelled_by_user',
  'cancelled_by_policy',
  'expired',
  'paused',
] as const satisfies readonly CampaignState[];

export type StopState = (typeof STOP_STATES)[number];

export function isStopState(state: CampaignState): state is StopState {
  return (STOP_STATES as readonly string[]).includes(state);
}

export function isTerminalStop(state: CampaignState): boolean {
  return isStopState(state) && state !== 'paused';
}
