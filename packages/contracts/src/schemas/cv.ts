import { z } from 'zod';
import { OnboardingStep } from './session.js';

export const ALGORITHM_VERSION = 'readiness-v1';
export const EXTRACTION_SCHEMA_VERSION = 'cv-facts-v1';
export const EXTRACTION_PROMPT_VERSION = 'cv-extract-v1';

export const CvRole = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200).nullable(),
  startDate: z.string().max(32).nullable(),
  endDate: z.string().max(32).nullable(),
  isCurrent: z.boolean().default(false),
  location: z.string().max(200).nullable().optional(),
  bullets: z.array(z.string().max(800)).max(40).default([]),
  tools: z.array(z.string().max(80)).max(40).default([]),
  metrics: z.array(z.string().max(240)).max(20).default([]),
  scope: z.string().max(400).nullable().optional(),
});
export type CvRole = z.infer<typeof CvRole>;

export const CvFacts = z.object({
  fullName: z.string().max(200).nullable().optional(),
  emails: z.array(z.string().email()).max(5).default([]),
  phones: z.array(z.string().max(40)).max(5).default([]),
  locations: z.array(z.string().max(200)).max(8).default([]),
  links: z
    .object({
      linkedin: z.string().url().nullable().optional(),
      github: z.string().url().nullable().optional(),
      portfolio: z.string().url().nullable().optional(),
      other: z.array(z.string().url()).max(10).default([]),
    })
    .default({ other: [] }),
  summary: z.string().max(2000).nullable().optional(),
  skills: z.array(z.string().max(80)).max(80).default([]),
  roles: z.array(CvRole).max(30).default([]),
  education: z
    .array(
      z.object({
        school: z.string().max(200),
        degree: z.string().max(200).nullable().optional(),
        endDate: z.string().max(32).nullable().optional(),
      }),
    )
    .max(20)
    .default([]),
  targetRoleHints: z.array(z.string().max(120)).max(20).default([]),
});
export type CvFacts = z.infer<typeof CvFacts>;

export const ReadinessDimensions = z.object({
  evidenceCompleteness: z.number().min(0).max(100),
  outcomeQuality: z.number().min(0).max(100),
  targetRoleCoverage: z.number().min(0).max(100),
  careerConsistency: z.number().min(0).max(100),
  communicationClarity: z.number().min(0).max(100),
});
export type ReadinessDimensions = z.infer<typeof ReadinessDimensions>;

export const SendabilityChecklist = z.object({
  ok: z.boolean(),
  hasEmail: z.boolean(),
  hasLocation: z.boolean(),
  hasWorkingLink: z.boolean(),
  blockers: z.array(z.string()).default([]),
});
export type SendabilityChecklist = z.infer<typeof SendabilityChecklist>;

export const ReadinessResult = z.object({
  total: z.number().int().min(0).max(100),
  dimensions: ReadinessDimensions,
  gaps: z.array(z.string()).default([]),
  sendability: SendabilityChecklist,
  algorithmVersion: z.literal(ALGORITHM_VERSION),
  band: z.enum(['ready', 'improve', 'limited']),
});
export type ReadinessResult = z.infer<typeof ReadinessResult>;

export const RegisterCvRequest = z.object({
  fileKey: z.string().min(1).max(400),
  contentType: z.enum([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
  originalFilename: z.string().max(260).optional(),
});
export type RegisterCvRequest = z.infer<typeof RegisterCvRequest>;

export const RegisterCvResponse = z.object({
  ok: z.literal(true),
  cvDocumentId: z.string().uuid(),
  fileKey: z.string(),
  onboardingStep: OnboardingStep,
});
export type RegisterCvResponse = z.infer<typeof RegisterCvResponse>;

export const AnalyzeCvRequest = z.object({
  cvDocumentId: z.string().uuid(),
});
export type AnalyzeCvRequest = z.infer<typeof AnalyzeCvRequest>;

export const AnalyzeCvResponse = z.object({
  ok: z.literal(true),
  cvDocumentId: z.string().uuid(),
  extractionId: z.string().uuid(),
  readiness: ReadinessResult,
  facts: CvFacts,
  onboardingStep: OnboardingStep,
});
export type AnalyzeCvResponse = z.infer<typeof AnalyzeCvResponse>;
