import type OpenAI from 'openai';
import { letterIsGrounded } from './letter.js';

const FLATTERY =
  /\b(passionate|thrilled|excited|leverage|delve|synergy|cutting-edge|fast-paced|world-class|dynamic team|i hope)\b/i;

function modelName(): string {
  return process.env.XAI_MODEL?.trim() || 'grok-4.7';
}

/** Two grounded sentences, or nothing. A generic line is worse than a gap. */
export function acceptInterest(text: string, source: string, company: string): string | null {
  const clean = text
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || !company.trim()) return null;
  if (!/^i'm interested because\b/i.test(clean)) return null;
  if (FLATTERY.test(clean)) return null;
  if (!clean.toLowerCase().includes(company.toLowerCase())) return null;
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 1 || sentences.length > 2) return null;
  if (clean.split(/\s+/).length > 80) return null;
  if (!letterIsGrounded(clean, source)) return null;
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

export async function writeRoleInterest(
  client: OpenAI,
  input: { company: string; role: string; description: string; bullets: string[] },
): Promise<string | null> {
  const description = input.description.replace(/\s+/g, ' ').trim().slice(0, 2200);
  const bullets = input.bullets.map((bullet) => bullet.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (description.length < 80 || bullets.length === 0) return null;
  const source = [input.company, input.role, description, ...bullets].join('\n');
  try {
    const response = await client.chat.completions.create({
      model: modelName(),
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'Write exactly two sentences for one job email. Nothing else. Sentence 1 starts with "I\'m interested because" and names one concrete operating condition from the POSTING: how this work actually runs. Use a detail that the job title alone does not give. Do not compliment the brand and do not paraphrase the About Us paragraph. Sentence 2 ties one fact from CANDIDATE PROOF to that condition. Numbers, employers, and tools in sentence 2 must appear in CANDIDATE PROOF. Do not add a metric, employer, or tool that is not written there. Name the company. No greeting. Under 70 words.',
        },
        {
          role: 'user',
          content: `COMPANY: ${input.company}\nROLE: ${input.role}\nPOSTING:\n${description}\n\nCANDIDATE PROOF:\n${bullets.map((bullet) => `- ${bullet}`).join('\n')}`,
        },
      ],
    });
    return acceptInterest(response.choices[0]?.message?.content ?? '', source, input.company);
  } catch {
    return null;
  }
}
