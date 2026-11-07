import { normalizeEmail, saveSeat } from "@/lib/waitlist";

const hits = new Map<string, number[]>();

function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < 60 * 60 * 1000);
  if (recent.length >= 8) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return "local";
}

export async function POST(req: Request) {
  if (!allowed(clientIp(req))) {
    return Response.json(
      { error: "Too many tries. Wait a while, then send it again." },
      { status: 429 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  let raw: unknown = "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
    raw = body?.email;
  } else {
    const form = await req.formData();
    raw = form.get("email");
  }

  const email = normalizeEmail(raw);
  const wantsJson = contentType.includes("application/json");

  if (!email) {
    if (!wantsJson) {
      return Response.redirect(new URL("/?seat=bad", req.url), 303);
    }
    return Response.json(
      { error: "Use a full email address." },
      { status: 400 },
    );
  }

  const saved = await saveSeat(email);

  if (!wantsJson) {
    const seat = saved.ok && saved.already ? "already" : "saved";
    return Response.redirect(new URL(`/?seat=${seat}`, req.url), 303);
  }

  if (saved.ok && saved.already) {
    return Response.json({ ok: true, already: true });
  }
  return Response.json({ ok: true });
}
