import OpenAI from 'openai';
import {
  CvFacts,
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  FieldConfidence,
  type CvFacts as CvFactsType,
  type FieldConfidence as FieldConfidenceType,
  type ParseQuality,
} from '@firstround/contracts';
import type { RenderedPage } from './pdf-render.js';

const SYSTEM = `You extract structured CV facts for First Round.
Return JSON only.
Never invent employers, degrees, metrics, or dates that are not visible.
Keep bullets close to the source wording.
For multi-column layouts, read left column then right column, top to bottom.
Include confidence scores from 0 to 1 for contact, roles, skills, education, and overall.
targetRoleHints are short role-family guesses from the CV itself, not advice.
Schema keys: fullName, emails, phones, locations, links{linkedin,github,portfolio,other[]}, summary, skills[], roles[{title,company,startDate,endDate,isCurrent,location,bullets[],tools[],metrics[],scope}], education[{school,degree,endDate}], targetRoleHints[], confidence{overall,contact,roles,skills,education,notes[]}.`;

export type ExtractResult = {
  facts: CvFactsType;
  confidence: FieldConfidenceType;
  modelVersion: string;
  promptVersion: string;
  schemaVersion: string;
  visionUsed: boolean;
};

export function createGrokClient(env: NodeJS.ProcessEnv = process.env): OpenAI | null {
  const key = env.XAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: env.XAI_BASE_URL?.trim() || 'https://api.x.ai/v1',
  });
}

type ModelPayload = CvFactsType & { confidence?: FieldConfidenceType };

function heuristicConfidence(facts: CvFactsType, parse: ParseQuality): FieldConfidenceType {
  const roles = facts.roles ?? [];
  const contact =
    ((facts.emails?.length ?? 0) > 0 ? 0.35 : 0) +
    ((facts.phones?.length ?? 0) > 0 ? 0.2 : 0) +
    ((facts.locations?.length ?? 0) > 0 ? 0.2 : 0) +
    0.25;
  const rolesScore =
    roles.length === 0
      ? 0.3
      : Math.min(0.95, 0.5 + roles.length * 0.07 + (roles[0]?.bullets?.length ? 0.1 : 0));
  const skills = Math.min(0.95, 0.35 + (facts.skills?.length ?? 0) * 0.05);
  const education = (facts.education?.length ?? 0) > 0 ? 0.8 : 0.4;
  const parseAdj = parse.quality === 'high' ? 0.05 : parse.quality === 'low' ? -0.1 : 0;
  const overall = Math.max(
    0.25,
    Math.min(0.98, (Math.min(1, contact) + rolesScore + skills + education) / 4 + parseAdj),
  );
  return {
    overall,
    contact: Math.min(1, contact),
    roles: rolesScore,
    skills,
    education,
    notes: parse.notes.slice(0, 6),
  };
}

function parseModelJson(raw: string): ModelPayload {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const confidenceRaw = parsed.confidence;
  delete parsed.confidence;
  const facts = CvFacts.parse(parsed);
  const confidence = FieldConfidence.safeParse(confidenceRaw);
  return confidence.success ? { ...facts, confidence: confidence.data } : facts;
}

export async function extractCvFactsWithGrok(
  text: string,
  client: OpenAI,
  opts: {
    model?: string;
    pages?: RenderedPage[];
    parse: ParseQuality;
  },
): Promise<ExtractResult> {
  const model = opts.model ?? process.env.XAI_MODEL?.trim() ?? 'grok-4.3';
  const useVision =
    opts.pages &&
    opts.pages.length > 0 &&
    (opts.parse.quality !== 'high' || opts.parse.multiColumnSuspected || opts.parse.sparseText);

  let raw: string | null | undefined;
  let visionUsed = false;

  if (useVision && opts.pages) {
    visionUsed = true;
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: `Extract CV facts as JSON from these page images and the helper text.\nHelper text (may be column-scrambled):\n${text.slice(0, 40_000)}`,
      },
      ...opts.pages.slice(0, 2).map((page): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${page.png.toString('base64')}`,
        },
      })),
    ];
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content },
      ],
    });
    raw = response.choices[0]?.message?.content;
  } else {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Extract CV facts as JSON.\n\nCV text:\n${text.slice(0, 100_000)}`,
        },
      ],
    });
    raw = response.choices[0]?.message?.content;
  }

  if (!raw) throw new Error('Empty model response');
  const payload = parseModelJson(raw);
  const { confidence: modelConfidence, ...factFields } = payload;
  const facts = CvFacts.parse(factFields);
  const confidence = modelConfidence ?? heuristicConfidence(facts, opts.parse);

  return {
    facts,
    confidence,
    modelVersion: model,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    visionUsed,
  };
}
