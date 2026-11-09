import { z } from 'zod';
import { OnboardingStep } from './session.js';

export const PreferencesPayload = z.object({
  jobFamilies: z.array(z.string().min(1).max(80)).max(20).default([]),
  locations: z.array(z.string().min(1).max(120)).max(20).default([]),
  targetLevel: z.string().max(80).nullable().optional(),
  links: z
    .object({
      linkedin: z.string().url().optional(),
      github: z.string().url().optional(),
      portfolio: z.string().url().optional(),
    })
    .default({}),
});
export type PreferencesPayload = z.infer<typeof PreferencesPayload>;

export const PreferencesResponse = z.object({
  ok: z.literal(true),
  preferences: PreferencesPayload,
  onboardingStep: OnboardingStep,
});
export type PreferencesResponse = z.infer<typeof PreferencesResponse>;

export const UpdatePreferencesRequest = PreferencesPayload;
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequest>;
