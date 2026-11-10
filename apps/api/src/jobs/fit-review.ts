import type OpenAI from 'openai';

const MODEL = 'grok-4.20-0309-non-reasoning';

export type FitVerdict = {
  sameProfession: boolean;
  fit: number;
};

export function parseFitVerdict(raw: string): FitVerdict | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const json = JSON.parse(raw.slice(start, end + 1)) as {
      sameProfession?: unknown;
      fit?: unknown;
    };
    if (typeof json.sameProfession !== 'boolean') return null;
    const fit = Number(json.fit);
    if (!Number.isFinite(fit)) return null;
    return { sameProfession: json.sameProfession, fit: Math.max(0, Math.min(100, Math.round(fit))) };
  } catch {
    return null;
  }
}

/** One job at a time. A wrong profession is a no, even if some skills overlap. */
export async function judgeJobFit(
  client: OpenAI,
  input: {
    profession: string;
    cvLines: string[];
    title: string;
    company: string;
    skills: string[];
    description: string;
  },
): Promise<FitVerdict | null> {
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 120,
    messages: [
      {
        role: 'system',
        content:
          'Decide if this person should be emailed about this job. sameProfession is false when the job is a different kind of work, even if a tool name overlaps. Return only JSON {"sameProfession":boolean,"fit":number}. fit is 0 to 100.',
      },
      {
        role: 'user',
        content: [
          `Person profession: ${input.profession}`,
          'CV lines:',
          ...input.cvLines.slice(0, 8),
          `Job title: ${input.title}`,
          `Company: ${input.company}`,
          `Job skills: ${input.skills.slice(0, 12).join(', ') || 'none'}`,
          `Job text: ${input.description.slice(0, 700)}`,
        ].join('\n'),
      },
    ],
  });
  const text = res.choices?.[0]?.message?.content ?? '';
  return parseFitVerdict(text);
}
