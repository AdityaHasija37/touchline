import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createBriefingLookupClient } from "@/lib/supabase/admin";
import { clientKey, TOKEN_PATTERN } from "@/lib/share/token";
import { snapshotSchema, type Snapshot } from "@/lib/domain/snapshot";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

/**
 * Shared public lookup for the briefing JSON and PDF routes. Never logs the body. Revoked and
 * unknown links get the same generic 404.
 */
export async function lookupBriefing(request: NextRequest, purpose: "view" | "pdf" = "view"): Promise<{ status: "ok"; snapshot: Snapshot } | { status: "fail"; response: NextResponse }> {
  const fail = (status: number, body: object, extra: Record<string, string> = {}) => ({ status: "fail" as const, response: NextResponse.json(body, { status, headers: { ...HEADERS, ...extra } }) });
  const raw = await request.text();
  if (raw.length > 200) return fail(404, { status: "not_found" });
  let token: unknown;
  try {
    token = (JSON.parse(raw) as { token?: unknown }).token;
  } catch {
    token = null;
  }

  // Prefer the header the hosting platform sets itself (Vercel), then generic proxy headers.
  const h = request.headers;
  const ip = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const { data, error } = await createBriefingLookupClient().rpc("get_published_snapshot", {
    p_token: typeof token === "string" && TOKEN_PATTERN.test(token) ? token : "",
    p_client_hash: clientKey(ip),
    p_purpose: purpose,
  });
  if (error) return fail(503, { status: "error" });

  const result = data as { status: "ok" | "not_found" | "rate_limited"; snapshot?: unknown };
  if (result.status === "rate_limited") return fail(429, { status: "rate_limited" }, { "Retry-After": "60" });
  const parsed = result.status === "ok" ? snapshotSchema.safeParse(result.snapshot) : null;
  if (!parsed?.success) return fail(404, { status: "not_found" });
  return { status: "ok", snapshot: parsed.data };
}
