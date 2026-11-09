import OpenAI from 'openai';
import { ZodError } from 'zod';
import { CvFacts, type CvFacts as CvFactsType, type ReadinessResult } from '@firstround/contracts';
import { BadRequestException } from '@nestjs/common';
import { coerceCvFactsPayload } from './coerce-cv-facts.js';

export const SUPERCHARGE_MODEL = 'grok-4.7';

const SYSTEM = `You supercharge a CV for First Round LetterProof.
Return JSON only with keys facts (same CV fact schema) and rewrittenText (plain text CV).
Hard rules:
- Keep every employer, title, date, email, phone, location, link, school, skill, and tool. Add none.
- Every number and unit (%, million, users, x) in facts and rewrittenText must already appear in the input.
- Replace each bullet with one line of at least 12 words. Lead with an ownership verb the source already supports (led, owned, built, shipped, launched, grew, cut, reduced, increased, designed, drove). Keep that bullet's original number in the same line.
- Do not add bullets. Do not drop a numbered bullet. Put the strongest numbered bullet first inside each role.
- Every string field is a JSON string, never a bare number.
- rewrittenText is a clean plain-text CV using only those facts.`;

export async function superchargeCvWithGrok(opts: {
  client: OpenAI;
  facts: CvFactsType;
  readiness: ReadinessResult;
  model?: string;
}): Promise<{ facts: CvFactsType; rewrittenText: string; modelVersion: string }> {
  const model = (opts.model ?? process.env.XAI_SUPERCHARGE_MODEL?.trim()) || SUPERCHARGE_MODEL;
  const response = await opts.client.chat.completions.create({
    model,
    temperature: 0.1,
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
          instruction:
            'Raise proof emphasis. The readiness score must not depend on dropping dates, tools, or numbers.',
        }),
      },
    ],
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new BadRequestException('Supercharge returned an empty response. Try again.');
  }
  let parsed: { facts?: unknown; rewrittenText?: unknown };
  try {
    parsed = JSON.parse(raw) as { facts?: unknown; rewrittenText?: unknown };
  } catch {
    throw new BadRequestException('Supercharge returned unreadable JSON. Try again.');
  }
  let facts: CvFactsType;
  try {
    facts = CvFacts.parse(coerceCvFactsPayload(parsed.facts));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(
        'Supercharge returned facts we could not validate. Try again, or re-analyze the CV first.',
      );
    }
    throw error;
  }
  const rewrittenText = typeof parsed.rewrittenText === 'string' ? parsed.rewrittenText.trim() : '';
  if (rewrittenText.length < 40) {
    throw new BadRequestException('Supercharge returned empty rewritten text. Try again.');
  }
  return { facts, rewrittenText: rewrittenText.slice(0, 120_000), modelVersion: model };
}
