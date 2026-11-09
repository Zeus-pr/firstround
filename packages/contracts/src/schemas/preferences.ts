import { z } from 'zod';
import { OnboardingStep } from './session.js';

const optionalHttpUrl = z.union([z.string().url(), z.literal('')]).optional();

export const PreferencesPayload = z.object({
  jobFamilies: z.array(z.string().min(1).max(80)).max(20).default([]),
  locations: z.array(z.string().min(1).max(120)).max(20).default([]),
  targetLevel: z.string().max(80).nullable().optional(),
  links: z
    .object({
      linkedin: optionalHttpUrl,
      github: optionalHttpUrl,
      portfolio: optionalHttpUrl,
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
