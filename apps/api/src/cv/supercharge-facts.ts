import { CvFacts, type CvFacts as CvFactsType, type ReadinessResult } from '@firstround/contracts';
import {
  METRIC_RE,
  OWNERSHIP_RE,
  VAGUE_RE,
  lockReadinessFloor,
  scoreCvReadiness,
} from '../readiness/scorer.js';

const MAGNITUDE_RE =
  /\b(k|m|b|million|billion|thousand|percent|users|customers|revenue|arr|mrr|x)\b|%/gi;

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function uniq(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = norm(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
    if (out.length >= max) break;
  }
  return out;
}

function numberTokens(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

function magnitudes(text: string): string[] {
  return (text.match(MAGNITUDE_RE) ?? []).map((token) =>
    token.toLowerCase().replace('%', 'percent'),
  );
}

function corpusFrom(facts: CvFactsType): { numbers: Set<string>; magnitudes: Set<string> } {
  const blob = JSON.stringify(facts);
  return { numbers: new Set(numberTokens(blob)), magnitudes: new Set(magnitudes(blob)) };
}

function grounded(
  text: string,
  corpus: { numbers: Set<string>; magnitudes: Set<string> },
): boolean {
  return (
    numberTokens(text).every((token) => corpus.numbers.has(token)) &&
    magnitudes(text).every((token) => corpus.magnitudes.has(token))
  );
}

function roleKey(role: { title: string; company: string | null }): string {
  return `${norm(role.title)}|${norm(role.company ?? '')}`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function bulletQuality(bullets: string[]): number {
  let quality = 0;
  for (const bullet of bullets) {
    const words = wordCount(bullet);
    if (words >= 12) quality += 3;
    else if (words >= 8) quality += 2;
    if (METRIC_RE.test(bullet)) quality += 3;
    if (OWNERSHIP_RE.test(bullet)) quality += 2;
    if (VAGUE_RE.test(bullet) && !METRIC_RE.test(bullet)) quality -= 3;
  }
  return quality;
}

function pickBullets(original: string[], proposed: string[]): string[] {
  if (proposed.length === 0) return original;
  const needed = new Set(original.flatMap(numberTokens));
  const present = new Set(proposed.flatMap(numberTokens));
  for (const token of needed) {
    if (!present.has(token)) return original;
  }
  if (bulletQuality(proposed) >= bulletQuality(original)) return proposed.slice(0, 40);
  return original;
}

function pickSummary(
  original: string | null | undefined,
  proposed: string | null | undefined,
  corpus: { numbers: Set<string>; magnitudes: Set<string> },
): string | null {
  const next = proposed?.trim() ?? '';
  const prev = original?.trim() ?? '';
  if (next && grounded(next, corpus) && next.length >= Math.max(40, prev.length))
    return next.slice(0, 2000);
  return prev || null;
}

/**
 * Keep every original employer, date, contact, and number.
 * Accept rewritten bullets only when they stay grounded and read at least as strong.
 */
export function preserveCvEvidence(original: CvFactsType, proposed: CvFactsType): CvFactsType {
  const corpus = corpusFrom(original);
  const links = original.links ?? { other: [] };
  const roles = (original.roles ?? []).map((role) => {
    const match = (proposed.roles ?? []).find((candidate) => roleKey(candidate) === roleKey(role));
    const proposedBullets = (match?.bullets ?? []).filter(
      (bullet) => grounded(bullet, corpus) && !(VAGUE_RE.test(bullet) && !METRIC_RE.test(bullet)),
    );
    const tools = uniq(
      [...(role.tools ?? []), ...(match?.tools ?? []).filter((tool) => grounded(tool, corpus))],
      40,
    );
    const metrics = uniq(
      [
        ...(role.metrics ?? []),
        ...(match?.metrics ?? []).filter(
          (metric) => grounded(metric, corpus) && numberTokens(metric).length > 0,
        ),
      ],
      20,
    );
    const scope =
      match?.scope && grounded(match.scope, corpus) && match.scope.trim().length > 0
        ? match.scope.trim()
        : (role.scope ?? null);
    return {
      ...role,
      title: role.title,
      company: role.company,
      startDate: role.startDate,
      endDate: role.endDate,
      isCurrent: role.isCurrent,
      location: role.location ?? null,
      bullets: pickBullets(role.bullets ?? [], proposedBullets),
      tools,
      metrics,
      scope,
    };
  });

  const skills = uniq(
    [
      ...(original.skills ?? []),
      ...(proposed.skills ?? []).filter((skill) => grounded(skill, corpus)),
      ...roles.flatMap((role) => role.tools ?? []),
    ],
    80,
  );

  return CvFacts.parse({
    fullName: original.fullName ?? null,
    emails: original.emails ?? [],
    phones: original.phones ?? [],
    locations: original.locations ?? [],
    links: {
      linkedin: links.linkedin ?? null,
      github: links.github ?? null,
      portfolio: links.portfolio ?? null,
      other: links.other ?? [],
    },
    summary: pickSummary(original.summary, proposed.summary, corpus),
    skills,
    roles,
    education: original.education ?? [],
    targetRoleHints: uniq(
      [
        ...(original.targetRoleHints ?? []),
        ...(proposed.targetRoleHints ?? []).filter((hint) => grounded(hint, corpus)),
      ],
      20,
    ),
  });
}

function proseShape(facts: CvFactsType): string {
  return JSON.stringify({
    summary: facts.summary ?? null,
    roles: (facts.roles ?? []).map((role) => role.bullets ?? []),
  });
}

export function factsToPlainText(facts: CvFactsType): string {
  const lines: string[] = [];
  if (facts.fullName) lines.push(facts.fullName);
  const contact = [...(facts.emails ?? []), ...(facts.phones ?? []), ...(facts.locations ?? [])];
  if (contact.length > 0) lines.push(contact.join(' · '));
  const links = [
    facts.links?.linkedin,
    facts.links?.github,
    facts.links?.portfolio,
    ...(facts.links?.other ?? []),
  ].filter((link): link is string => Boolean(link));
  if (links.length > 0) lines.push(links.join(' · '));
  if (facts.summary) lines.push('', facts.summary);
  if ((facts.skills ?? []).length > 0) lines.push('', 'Skills', (facts.skills ?? []).join(', '));
  for (const role of facts.roles ?? []) {
    const end = role.isCurrent ? 'Present' : role.endDate;
    const dates = [role.startDate, end].filter(Boolean).join(' – ');
    const heading = `${role.title}${role.company ? ` — ${role.company}` : ''}${dates ? ` (${dates})` : ''}`;
    lines.push('', heading);
    for (const bullet of role.bullets ?? []) lines.push(`• ${bullet}`);
    if ((role.metrics ?? []).length > 0) lines.push(`Results: ${(role.metrics ?? []).join('; ')}`);
  }
  for (const school of facts.education ?? []) {
    const degree = school.degree ? `${school.degree}, ` : '';
    lines.push('', `${degree}${school.school}${school.endDate ? ` (${school.endDate})` : ''}`);
  }
  const text = lines.join('\n').trim();
  if (text.length >= 40) return text.slice(0, 120_000);
  return `${text}\n\nProof preserved from the original CV.`.slice(0, 120_000);
}

export function finalizeSupercharge(input: {
  original: CvFactsType;
  proposed: CvFactsType;
  prior: ReadinessResult;
  targetHints?: string[];
}): { facts: CvFactsType; readiness: ReadinessResult; acceptedRewrite: boolean } {
  const hints = input.targetHints ?? [];
  const scoreOpts = { confidence: input.prior.confidence, parse: input.prior.parse };
  const kept = preserveCvEvidence(input.original, input.original);
  const lifted = preserveCvEvidence(input.original, input.proposed);
  const keptScore = scoreCvReadiness(kept, hints, scoreOpts);
  const liftedScore = scoreCvReadiness(lifted, hints, scoreOpts);
  const useLift = liftedScore.total >= keptScore.total;
  const facts = useLift ? lifted : kept;
  const scored = useLift ? liftedScore : keptScore;
  return {
    facts,
    readiness: lockReadinessFloor(input.prior, scored),
    acceptedRewrite: useLift && proseShape(lifted) !== proseShape(kept),
  };
}
