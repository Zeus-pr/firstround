import type OpenAI from 'openai';
import { letterIsGrounded } from './letter.js';

const FLATTERY =
  /\b(passionate|thrilled|excited|leverage|delve|synergy|cutting-edge|fast-paced|world-class|dynamic team|i hope)\b/i;

function modelName(): string {
  return process.env.XAI_MODEL?.trim() || 'grok-4.7';
}

function proofWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 2);
}

function repeatsProof(text: string, bullets: string[]): boolean {
  const hay = proofWords(text).join(' ');
  return bullets.some((bullet) => {
    const words = proofWords(bullet);
    if (words.length < 8) return false;
    return hay.includes(words.slice(0, 8).join(' '));
  });
}

/** Two grounded sentences, or nothing. A copied proof line is not a reason. */
export function acceptInterest(
  text: string,
  source: string,
  company: string,
  bullets: string[] = [],
): string | null {
  const clean = text
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || !company.trim()) return null;
  if (!/^i'm interested because\b/i.test(clean)) return null;
  if (FLATTERY.test(clean)) return null;
  if (!clean.toLowerCase().includes(company.toLowerCase())) return null;
  const sentences = clean
    .replace(/\b(?:Rs|Mr|Ms|Dr|Inc|Ltd)\./g, (mark) => mark.replace('.', '·'))
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  if (sentences.length < 1 || sentences.length > 2) return null;
  if (clean.split(/\s+/).length > 90) return null;
  if (repeatsProof(clean, bullets)) return null;
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
  const proof = bullets.map((bullet) => `- ${bullet}`).join('\n');
  let rejected = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model: modelName(),
        temperature: 0.4 + attempt * 0.05,
        max_tokens: 260,
        messages: [
          {
            role: 'system',
            content:
              'Write exactly two sentences for one job email. Nothing else. Sentence 1 starts with "I\'m interested because" and names one concrete operating condition from the POSTING: how this work actually runs. Use a detail the job title alone does not give. Do not compliment the brand. Sentence 2 connects the candidate to that condition in new words. Do not paste or closely repeat a CANDIDATE PROOF line. Numbers and employers in sentence 2 must already appear in CANDIDATE PROOF. Name the company. No greeting. Under 70 words.',
          },
          {
            role: 'user',
            content: `COMPANY: ${input.company}\nROLE: ${input.role}\nPOSTING:\n${description}\n\nCANDIDATE PROOF:\n${proof}${rejected ? `\n\nThe previous try was rejected: ${rejected} Write a different pair of sentences.` : ''}`,
          },
        ],
      });
      const raw = response.choices[0]?.message?.content ?? '';
      const accepted = acceptInterest(raw, source, input.company, bullets);
      if (accepted) return accepted;
      rejected = repeatsProof(raw, bullets)
        ? 'it repeated a proof line already in the email'
        : 'it was not two grounded sentences that name the company';
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 402 || status === 403) return null;
      rejected = 'the model did not answer';
    }
  }
  return postingLine(input, source, bullets);
}

/** Last resort when the model keeps failing: one posting sentence, never a copied proof line. */
function postingLine(
  input: { company: string; role: string; description: string },
  source: string,
  bullets: string[],
): string | null {
  const sentences = input.description
    .replace(/\b(?:Rs|Mr|Ms|Dr|Inc|Ltd)\./g, (mark) => mark.replace('.', '·'))
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/·/g, '.').trim())
    .filter((sentence) => sentence.length >= 50 && sentence.length <= 240);
  for (const sentence of sentences) {
    const clause = sentence.replace(/^(the|a|an)\s+/i, '');
    const line = `I'm interested because the ${input.role} role at ${input.company} comes down to this: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
    const accepted = acceptInterest(line, source, input.company, bullets);
    if (accepted) return accepted;
  }
  return null;
}
