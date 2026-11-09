import { z } from 'zod';

export const ONBOARDING_STEPS = [
  'account',
  'cv',
  'readiness',
  'preferences',
  'gmail',
  'done',
] as const;
export const OnboardingStep = z.enum(ONBOARDING_STEPS);
export type OnboardingStep = z.infer<typeof OnboardingStep>;

export const SessionUser = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  firebaseUid: z.string().min(1),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  onboardingStep: OnboardingStep,
  created: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUser>;

export const SessionResponse = z.object({
  ok: z.literal(true),
  user: SessionUser,
});
export type SessionResponse = z.infer<typeof SessionResponse>;
