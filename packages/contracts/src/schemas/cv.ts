import { z } from 'zod';
import { OnboardingStep } from './session.js';

export const ALGORITHM_VERSION = 'readiness-v2';
export const EXTRACTION_SCHEMA_VERSION = 'cv-facts-v2';
export const EXTRACTION_PROMPT_VERSION = 'cv-extract-v2';
export const TAXONOMY_VERSION = 'taxonomy-v1';

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

/** Model + parser confidence. Low confidence never invents failure; it softens certainty. */
export const FieldConfidence = z.object({
  overall: z.number().min(0).max(1),
  contact: z.number().min(0).max(1),
  roles: z.number().min(0).max(1),
  skills: z.number().min(0).max(1),
  education: z.number().min(0).max(1),
  notes: z.array(z.string().max(240)).max(12).default([]),
});
export type FieldConfidence = z.infer<typeof FieldConfidence>;

export const ParseQuality = z.object({
  method: z.enum(['text', 'ocr', 'vision', 'hybrid']),
  textChars: z.number().int().min(0),
  pageEstimate: z.number().int().min(0),
  pagesRendered: z.number().int().min(0).default(0),
  multiColumnSuspected: z.boolean(),
  sparseText: z.boolean(),
  ocrUsed: z.boolean(),
  visionUsed: z.boolean(),
  quality: z.enum(['high', 'medium', 'low']),
  notes: z.array(z.string().max(240)).max(12).default([]),
});
export type ParseQuality = z.infer<typeof ParseQuality>;

export const NormalizedLexicon = z.object({
  taxonomyVersion: z.literal(TAXONOMY_VERSION),
  skills: z.array(z.string().max(80)).max(80).default([]),
  titles: z.array(z.string().max(120)).max(40).default([]),
  families: z.array(z.string().max(80)).max(20).default([]),
});
export type NormalizedLexicon = z.infer<typeof NormalizedLexicon>;

export const ReadinessCheck = z.object({
  id: z.string().max(64),
  label: z.string().max(160),
  passed: z.boolean(),
  /** soft = coaching; hard = chronology/contact issues */
  severity: z.enum(['soft', 'hard']),
});
export type ReadinessCheck = z.infer<typeof ReadinessCheck>;

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

export const ReadinessRecommendation = z.object({
  action: z.enum(['continue', 'supercharge', 'strengthen']),
  headline: z.string().max(120),
  body: z.string().max(400),
});
export type ReadinessRecommendation = z.infer<typeof ReadinessRecommendation>;

export const ReadinessBand = z.enum(['ready', 'supercharge', 'strengthen']);
export type ReadinessBand = z.infer<typeof ReadinessBand>;

export const ReadinessResult = z.object({
  total: z.number().int().min(0).max(100),
  dimensions: ReadinessDimensions,
  /** Combined plain-language list for simple UIs */
  gaps: z.array(z.string()).default([]),
  /** True missing proof */
  genuineGaps: z.array(z.string()).default([]),
  /** Present but buried or weakly worded */
  underEmphasised: z.array(z.string()).default([]),
  checks: z.array(ReadinessCheck).max(40).default([]),
  sendability: SendabilityChecklist,
  confidence: FieldConfidence,
  parse: ParseQuality,
  normalized: NormalizedLexicon,
  recommendation: ReadinessRecommendation,
  algorithmVersion: z.literal(ALGORITHM_VERSION),
  band: ReadinessBand,
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

export const SUPERCHARGE_CREDIT_COST = 5;

export const SuperchargeCvRequest = z.object({
  cvDocumentId: z.string().uuid(),
});
export type SuperchargeCvRequest = z.infer<typeof SuperchargeCvRequest>;

export const SuperchargeCvResponse = z.object({
  ok: z.literal(true),
  cvDocumentId: z.string().uuid(),
  extractionId: z.string().uuid(),
  readiness: ReadinessResult,
  suggestions: z.array(z.string().min(1).max(240)).min(1).max(8),
  creditsCharged: z.number().int().min(0).max(SUPERCHARGE_CREDIT_COST),
  creditBalance: z.number().int(),
  onboardingStep: OnboardingStep,
});
export type SuperchargeCvResponse = z.infer<typeof SuperchargeCvResponse>;

export const CreditsBalanceResponse = z.object({
  ok: z.literal(true),
  balance: z.number().int(),
  superchargeCost: z.literal(SUPERCHARGE_CREDIT_COST),
  testMode: z.boolean(),
});
export type CreditsBalanceResponse = z.infer<typeof CreditsBalanceResponse>;
