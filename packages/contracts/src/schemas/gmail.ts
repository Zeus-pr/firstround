import { z } from 'zod';
import { OnboardingStep } from './session.js';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
] as const;

export const GmailStatusResponse = z.object({
  ok: z.literal(true),
  connected: z.boolean(),
  email: z.string().email().nullable(),
  scopes: z.array(z.string()).default([]),
  onboardingStep: OnboardingStep,
});
export type GmailStatusResponse = z.infer<typeof GmailStatusResponse>;

export const GmailConnectResponse = z.object({
  ok: z.literal(true),
  authorizeUrl: z.string().url(),
});
export type GmailConnectResponse = z.infer<typeof GmailConnectResponse>;

export const GmailDisconnectResponse = z.object({
  ok: z.literal(true),
  connected: z.literal(false),
  onboardingStep: OnboardingStep,
});
export type GmailDisconnectResponse = z.infer<typeof GmailDisconnectResponse>;
