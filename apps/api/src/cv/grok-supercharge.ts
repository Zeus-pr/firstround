import OpenAI from 'openai';
import { CvFacts, type CvFacts as CvFactsType, type ReadinessResult } from '@firstround/contracts';

const SYSTEM = `You supercharge a CV for First Round LetterProof.
Return JSON only with keys: facts (same schema as CV facts), rewrittenText (plain text CV).
Rules:
- Use only evidence already present in the provided facts and gaps.
- Never invent employers, degrees, dates, tools, or metrics.
- You may rephrase bullets, move stronger proof upward, and clarify ownership language.
- Fill metrics arrays only with numbers already present in bullets/metrics.
- rewrittenText must be a clean plain-text CV the candidate could copy.`;

export async function superchargeCvWithGrok(opts: {
  client: OpenAI;
  facts: CvFactsType;
  readiness: ReadinessResult;
  model?: string;
}): Promise<{ facts: CvFactsType; rewrittenText: string; modelVersion: string }> {
  const model = opts.model ?? process.env.XAI_MODEL?.trim() ?? 'grok-4.3';
  const response = await opts.client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          facts: opts.facts,
          gaps: opts.readiness.gaps,
          genuineGaps: opts.readiness.genuineGaps,
          underEmphasised: opts.readiness.underEmphasised,
          band: opts.readiness.band,
          total: opts.readiness.total,
        }),
      },
    ],
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty supercharge response');
  const parsed = JSON.parse(raw) as { facts?: unknown; rewrittenText?: unknown };
  const facts = CvFacts.parse(parsed.facts);
  const rewrittenText = typeof parsed.rewrittenText === 'string' ? parsed.rewrittenText.trim() : '';
  if (rewrittenText.length < 40) throw new Error('Supercharge returned empty rewritten text');
  return { facts, rewrittenText: rewrittenText.slice(0, 120_000), modelVersion: model };
}
