/** Simple in-process sliding window. Fine for a single Railway replica. */
export function createIpRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  return (key: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

export function clientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || 'local';
  }
  return req.ip || 'local';
}
