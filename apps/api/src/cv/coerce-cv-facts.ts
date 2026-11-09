/** Soft-coerce model JSON so numeric metrics/dates don't fail CvFacts.parse. */
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

export function coerceCvFactsPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const facts = { ...(raw as Record<string, unknown>) };

  facts.fullName = coerceNullableString(facts.fullName);
  facts.summary = coerceNullableString(facts.summary);
  facts.phones = asStringArray(facts.phones);
  facts.locations = asStringArray(facts.locations);
  facts.skills = asStringArray(facts.skills);
  facts.targetRoleHints = asStringArray(facts.targetRoleHints);

  if (Array.isArray(facts.roles)) {
    facts.roles = facts.roles.map((role) => {
      if (!role || typeof role !== 'object' || Array.isArray(role)) return role;
      const next = { ...(role as Record<string, unknown>) };
      next.title = coerceNullableString(next.title);
      next.company = coerceNullableString(next.company);
      next.startDate = coerceNullableString(next.startDate);
      next.endDate = coerceNullableString(next.endDate);
      next.location = coerceNullableString(next.location);
      next.scope = coerceNullableString(next.scope);
      next.bullets = asStringArray(next.bullets);
      next.tools = asStringArray(next.tools);
      next.metrics = asStringArray(next.metrics);
      return next;
    });
  }

  if (Array.isArray(facts.education)) {
    facts.education = facts.education.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
      const next = { ...(row as Record<string, unknown>) };
      next.school = coerceNullableString(next.school);
      next.degree = coerceNullableString(next.degree);
      next.endDate = coerceNullableString(next.endDate);
      return next;
    });
  }

  return facts;
}
