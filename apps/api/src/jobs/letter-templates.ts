export type LetterTemplateId = 'join' | 'work-with' | 'put-forward';

export type LetterInput = {
  company: string;
  role: string;
  sourceUrl: string | null;
  candidateName: string | null;
  recruiterName?: string | null;
  phone: string | null;
  linkedin: string | null;
  bullets: string[];
  /** Two sentences on why this posting, grounded in the CV. Omitted when the model cannot ground them. */
  interest?: string | null;
  shuffle: boolean;
  seed: string;
};

const TEMPLATES: LetterTemplateId[] = ['join', 'work-with', 'put-forward'];

export function pickTemplate(shuffle: boolean, seed: string): LetterTemplateId {
  if (!shuffle) return 'join';
  const n = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TEMPLATES[n % TEMPLATES.length] ?? 'join';
}

function firstName(full: string | null | undefined): string | null {
  const word = full?.trim().split(/\s+/)[0];
  return word || null;
}

function subjectFor(id: LetterTemplateId, input: LetterInput): string {
  const recruiter = input.recruiterName?.trim() || null;
  const candidate = firstName(input.candidateName);
  if (id === 'work-with') {
    return recruiter
      ? `${recruiter}, I would love to work with you`
      : 'I would love to work with you';
  }
  if (id === 'put-forward') {
    if (recruiter && candidate) return `Hi ${recruiter}, ${candidate} here.`;
    if (candidate) return `Hi, ${candidate} here.`;
    return `I would love to join ${input.company}`;
  }
  return recruiter
    ? `${recruiter}, I would love to join ${input.company}`
    : `I would love to join ${input.company}`;
}

function openingFor(id: LetterTemplateId, input: LetterInput): string {
  if (id === 'work-with') {
    return `I'm writing about the ${input.role} opening at ${input.company}. I'd like to be considered.`;
  }
  if (id === 'put-forward') {
    return `Putting my name forward for the ${input.role} opening at ${input.company}.`;
  }
  return `I'm writing about the ${input.role} opening at ${input.company}. I'd like to be considered.`;
}

/** Three letter shapes from the same proof. Shuffle picks one. Off always uses "join". */
export function renderLetter(input: LetterInput): {
  templateId: LetterTemplateId;
  subject: string;
  body: string;
} {
  const templateId = pickTemplate(input.shuffle, input.seed);
  const lines = ['Hi,', '', openingFor(templateId, input), ''];
  if (input.sourceUrl) lines.push(input.sourceUrl, '');
  const bullets = input.bullets
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (bullets.length > 0) {
    lines.push('A bit about me:', '');
    for (const bullet of bullets) lines.push(bullet, '');
  }
  const interest = input.interest?.trim();
  if (interest) lines.push(interest, '');
  lines.push('If you are still hiring, can we talk?', '');
  if (input.candidateName) lines.push(input.candidateName);
  if (input.phone) lines.push(input.phone);
  if (input.linkedin) lines.push(input.linkedin);
  return {
    templateId,
    subject: subjectFor(templateId, input),
    body: `${lines.join('\n').trim()}\n`,
  };
}
