import { NextResponse, type NextRequest } from "next/server";
import { createBriefingLookupClient } from "@/lib/supabase/admin";
import { clientKey, TOKEN_PATTERN } from "@/lib/share/token";
import { snapshotSchema } from "@/lib/domain/snapshot";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

/**
 * Public briefing lookup (S10). The token arrives in the POST body, never in a URL, so it can't
 * land in access logs or Referer headers. Never log the body. Revoked and unknown links get the
 * same generic 404.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 200) return NextResponse.json({ status: "not_found" }, { status: 404, headers: HEADERS });
  let token: unknown;
  try {
    token = (JSON.parse(raw) as { token?: unknown }).token;
  } catch {
    token = null;
  }

  // Prefer the header the hosting platform sets itself (Vercel), then generic proxy headers.
  const h = request.headers;
  const ip = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const supabase = createBriefingLookupClient();
  const { data, error } = await supabase.rpc("get_published_snapshot", {
    p_token: typeof token === "string" && TOKEN_PATTERN.test(token) ? token : "",
    p_client_hash: clientKey(ip),
  });
  if (error) return NextResponse.json({ status: "error" }, { status: 503, headers: HEADERS });

  const result = data as { status: "ok" | "not_found" | "rate_limited"; snapshot?: unknown };
  if (result.status === "rate_limited") {
    return NextResponse.json({ status: "rate_limited" }, { status: 429, headers: { ...HEADERS, "Retry-After": "60" } });
  }
  const parsed = result.status === "ok" ? snapshotSchema.safeParse(result.snapshot) : null;
  if (!parsed?.success) return NextResponse.json({ status: "not_found" }, { status: 404, headers: HEADERS });
  return NextResponse.json({ status: "ok", snapshot: parsed.data }, { headers: HEADERS });
}
