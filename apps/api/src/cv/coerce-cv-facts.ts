/** Soft-coerce model JSON so numeric/messy fields don't fail CvFacts.parse. */
function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => item != null && item.length > 0);
}

function coerceNullableString(value: unknown): unknown {
  if (value == null) return value;
  const text = asString(value);
  return text ?? value;
}

function coerceEmail(value: unknown): string | null {
  const text = asString(value)?.trim().toLowerCase() ?? null;
  if (!text) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return null;
  return text;
}

/** Accept scheme-less LinkedIn/GitHub links Grok often returns; drop junk. */
export function coerceHttpUrl(value: unknown): string | null {
  if (value == null) return null;
  const raw = asString(value)?.trim() ?? '';
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function coerceCvFactsPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const facts = { ...(raw as Record<string, unknown>) };

  facts.fullName = coerceNullableString(facts.fullName);
  facts.summary = coerceNullableString(facts.summary);
  facts.phones = asStringArray(facts.phones);
  facts.locations = asStringArray(facts.locations);
  facts.skills = asStringArray(facts.skills);
  facts.targetRoleHints = asStringArray(facts.targetRoleHints);

  if (Array.isArray(facts.emails)) {
    facts.emails = facts.emails
      .map((item) => coerceEmail(item))
      .filter((item): item is string => item != null)
      .slice(0, 5);
  } else {
    facts.emails = [];
  }

  const linksRaw =
    facts.links && typeof facts.links === 'object' && !Array.isArray(facts.links)
      ? { ...(facts.links as Record<string, unknown>) }
      : {};
  const other = Array.isArray(linksRaw.other)
    ? linksRaw.other
        .map((item) => coerceHttpUrl(item))
        .filter((item): item is string => item != null)
        .slice(0, 10)
    : [];
  facts.links = {
    linkedin: coerceHttpUrl(linksRaw.linkedin),
    github: coerceHttpUrl(linksRaw.github),
    portfolio: coerceHttpUrl(linksRaw.portfolio),
    other,
  };

  if (Array.isArray(facts.roles)) {
    facts.roles = facts.roles
      .map((role) => {
        if (!role || typeof role !== 'object' || Array.isArray(role)) return null;
        const next = { ...(role as Record<string, unknown>) };
        next.title = coerceNullableString(next.title);
        if (typeof next.title !== 'string' || next.title.trim().length === 0) return null;
        next.company = coerceNullableString(next.company);
        if (typeof next.company === 'string' && next.company.trim().length === 0)
          next.company = null;
        next.startDate = coerceNullableString(next.startDate);
        next.endDate = coerceNullableString(next.endDate);
        next.location = coerceNullableString(next.location);
        next.scope = coerceNullableString(next.scope);
        next.bullets = asStringArray(next.bullets);
        next.tools = asStringArray(next.tools);
        next.metrics = asStringArray(next.metrics);
        return next;
      })
      .filter(Boolean)
      .slice(0, 30);
  }

  if (Array.isArray(facts.education)) {
    facts.education = facts.education
      .map((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
        const next = { ...(row as Record<string, unknown>) };
        next.school = coerceNullableString(next.school);
        if (typeof next.school !== 'string' || next.school.trim().length === 0) return null;
        next.degree = coerceNullableString(next.degree);
        next.endDate = coerceNullableString(next.endDate);
        return next;
      })
      .filter(Boolean)
      .slice(0, 20);
  }

  return facts;
}
