import OpenAI from 'openai';
import type { CvFacts as CvFactsType, ReadinessResult } from '@firstround/contracts';

/** Non-reasoning model. grok-4.7 always reasons and was taking minutes to rewrite a CV. */
export const SUGGESTIONS_MODEL = 'grok-4.20-0309-non-reasoning';
export const SUGGESTIONS_TIMEOUT_MS = 20_000;

const SYSTEM = `You write short CV coaching lines for First Round LetterProof.
Return JSON only: {"suggestions":["line"]}.
Rules:
- 4 to 6 lines.
- Each line is one edit the candidate can make on the CV they already have.
- Use only the gaps and bullets provided. Never invent employers, dates, tools, or numbers.
- Do not rewrite the CV. Do not give a score.
- Each line is under 180 characters.`;

function numberTokens(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

export function algorithmSuggestions(readiness: ReadinessResult): string[] {
  const lines = [...readiness.genuineGaps, ...readiness.underEmphasised]
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const unique = [...new Set(lines)].slice(0, 8);
  if (unique.length > 0) return unique;
  return [
    'The score already matches the proof on this CV. Add a number you can stand behind on the strongest bullet.',
  ];
}

export function groundSuggestions(lines: unknown, facts: CvFactsType): string[] {
  const allowed = new Set(numberTokens(JSON.stringify(facts)));
  if (!Array.isArray(lines)) return [];
  const out: string[] = [];
  for (const line of lines) {
    if (typeof line !== 'string') continue;
    const text = line.trim().replace(/\s+/g, ' ');
    if (text.length < 12 || text.length > 240) continue;
    const numbers = numberTokens(text);
    if (numbers.some((token) => !allowed.has(token))) continue;
    if (out.includes(text)) continue;
    out.push(text);
    if (out.length >= 6) break;
  }
  return out;
}

function bulletSample(facts: CvFactsType): string[] {
  return (facts.roles ?? [])
    .flatMap((role) => role.bullets ?? [])
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0)
    .slice(0, 8)
    .map((bullet) => bullet.slice(0, 220));
}

export async function suggestCvLines(opts: {
  client: OpenAI;
  facts: CvFactsType;
  readiness: ReadinessResult;
  model?: string;
  timeoutMs?: number;
}): Promise<{ suggestions: string[]; modelVersion: string }> {
  const model = (opts.model ?? process.env.XAI_SUGGESTIONS_MODEL?.trim()) || SUGGESTIONS_MODEL;
  const timeoutMs = opts.timeoutMs ?? SUGGESTIONS_TIMEOUT_MS;
  const response = await opts.client.chat.completions.create(
    {
      model,
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            total: opts.readiness.total,
            band: opts.readiness.band,
            genuineGaps: opts.readiness.genuineGaps.slice(0, 8),
            underEmphasised: opts.readiness.underEmphasised.slice(0, 6),
            bullets: bulletSample(opts.facts),
          }),
        },
      ],
    },
    { signal: AbortSignal.timeout(timeoutMs) },
  );
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty suggestions response');
  const parsed = JSON.parse(raw) as { suggestions?: unknown };
  const suggestions = groundSuggestions(parsed.suggestions, opts.facts);
  if (suggestions.length === 0) throw new Error('No grounded suggestions');
  return { suggestions, modelVersion: model };
}
