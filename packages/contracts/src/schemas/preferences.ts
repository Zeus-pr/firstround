import { z } from 'zod';
import { OnboardingStep } from './session.js';

const optionalHttpUrl = z.union([z.string().url(), z.literal('')]).optional();

/** Soft search signals — empty never excludes; hits boost, misses mild demote. */
export const PreferencesCriteria = z.object({
  expectedCtcMinLakh: z.number().min(0).max(500).nullable().optional(),
  expectedCtcMaxLakh: z.number().min(0).max(500).nullable().optional(),
  desiredCompanies: z.array(z.string().min(1).max(120)).max(30).default([]),
  avoidCompanies: z.array(z.string().min(1).max(120)).max(30).default([]),
  industries: z.array(z.string().min(1).max(80)).max(20).default([]),
  skills: z.array(z.string().min(1).max(80)).max(40).default([]),
  workModes: z
    .array(z.enum(['remote', 'hybrid', 'onsite']))
    .max(3)
    .default([]),
  employmentTypes: z.array(z.string().min(1).max(40)).max(10).default([]),
  keywords: z.array(z.string().min(1).max(80)).max(30).default([]),
  noticePeriodDays: z.number().int().min(0).max(365).nullable().optional(),
  openToRelocation: z.boolean().nullable().optional(),
  minYearsExperience: z.number().int().min(0).max(50).nullable().optional(),
  maxYearsExperience: z.number().int().min(0).max(50).nullable().optional(),
});
export type PreferencesCriteria = z.infer<typeof PreferencesCriteria>;

export const EMPTY_PREFERENCES_CRITERIA: PreferencesCriteria = {
  expectedCtcMinLakh: null,
  expectedCtcMaxLakh: null,
  desiredCompanies: [],
  avoidCompanies: [],
  industries: [],
  skills: [],
  workModes: [],
  employmentTypes: [],
  keywords: [],
  noticePeriodDays: null,
  openToRelocation: null,
  minYearsExperience: null,
  maxYearsExperience: null,
};

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
  criteria: PreferencesCriteria.default(EMPTY_PREFERENCES_CRITERIA),
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
