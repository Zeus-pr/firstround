import OpenAI from 'openai';
import {
  CvFacts,
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  type CvFacts as CvFactsType,
} from '@firstround/contracts';

const SYSTEM = `You extract structured CV facts for First Round.
Return JSON only that matches the schema.
Use null or empty arrays when unknown.
Never invent employers, degrees, metrics, or dates that are not in the text.
Keep bullets close to the source wording.
targetRoleHints are short role-family guesses from the CV itself, not advice.`;

export type ExtractResult = {
  facts: CvFactsType;
  modelVersion: string;
  promptVersion: string;
  schemaVersion: string;
};

export function createGrokClient(env: NodeJS.ProcessEnv = process.env): OpenAI | null {
  const key = env.XAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: env.XAI_BASE_URL?.trim() || 'https://api.x.ai/v1',
  });
}

export async function extractCvFactsWithGrok(
  text: string,
  client: OpenAI,
  model = process.env.XAI_MODEL?.trim() || 'grok-4-fast-reasoning',
): Promise<ExtractResult> {
  const clipped = text.slice(0, 100_000);
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Extract CV facts as JSON with keys: fullName, emails, phones, locations, links{linkedin,github,portfolio,other[]}, summary, skills[], roles[{title,company,startDate,endDate,isCurrent,location,bullets[],tools[],metrics[],scope}], education[{school,degree,endDate}], targetRoleHints[].\n\nCV text:\n${clipped}`,
      },
    ],
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty model response');
  const parsed = CvFacts.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error('Model output failed schema validation');
  }
  return {
    facts: parsed.data,
    modelVersion: model,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
  };
}
