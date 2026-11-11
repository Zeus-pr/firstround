const BLOCKED_HOST =
  /^(localhost|metadata\.google\.internal|metadata\.internal)$|\.local$|\.internal$|\.localhost$/i;

export type ParsedOpening = {
  company: string;
  title: string;
  location: string | null;
  description: string;
  url: string | null;
  email: string | null;
};

export function assertPublicJobUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('bad-url');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad-url');
  if (url.username || url.password) throw new Error('blocked-url');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || BLOCKED_HOST.test(host) || isPrivateHost(host)) throw new Error('blocked-url');
  return url;
}

function isPrivateHost(host: string): boolean {
  if (
    host === '::1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;
  return false;
}

function clean(value: unknown, max = 240): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function jobPostingNodes(
  value: unknown,
  found: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    for (const item of value) jobPostingNodes(item, found);
    return found;
  }
  const record = asRecord(value);
  if (!record) return found;
  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item).toLowerCase() === 'jobposting')) found.push(record);
  if (record['@graph']) jobPostingNodes(record['@graph'], found);
  return found;
}

function organizationName(value: unknown): string {
  if (typeof value === 'string') return clean(value, 160);
  const record = asRecord(value);
  return clean(record?.name, 160);
}

function locationName(value: unknown): string {
  if (typeof value === 'string') return clean(value, 160);
  const record = asRecord(value);
  if (!record) return '';
  const address = asRecord(record.address);
  return clean(address?.addressLocality ?? record.name, 160);
}

/** Read a public job page. A missing company or title means the page still needs a closer read. */
export function openingFromHtml(html: string, pageUrl: string): ParsedOpening | null {
  const blocks = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const block of blocks) {
    try {
      const nodes = jobPostingNodes(JSON.parse(block[1] ?? ''));
      const job = nodes[0];
      if (!job) continue;
      const company = organizationName(job.hiringOrganization);
      const title = clean(job.title, 180);
      if (!company || !title) continue;
      const description = clean(job.description, 4000);
      const email = emailIn(description) ?? emailIn(htmlToText(html).slice(0, 8000));
      return {
        company,
        title,
        location: locationName(job.jobLocation) || null,
        description,
        url: clean(job.url, 500) || pageUrl,
        email,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function emailIn(text: string): string | null {
  const match = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (!match) return null;
  const email = match[0].toLowerCase();
  const domain = email.split('@')[1] ?? '';
  if (domain === 'example.com' || domain.endsWith('.png') || domain.endsWith('.jpg')) return null;
  return email;
}

export function openingFromModel(raw: string, fallbackUrl: string | null): ParsedOpening | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const json = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    if (json.isJob === false) return null;
    const company = clean(json.company, 160);
    const title = clean(json.title, 180);
    if (!company || !title) return null;
    const description = clean(json.description, 4000);
    const email = emailIn(clean(json.email, 180)) ?? emailIn(description);
    const url = clean(json.url, 500) || fallbackUrl;
    return {
      company,
      title,
      location: clean(json.location, 160) || null,
      description,
      url,
      email,
    };
  } catch {
    return null;
  }
}
