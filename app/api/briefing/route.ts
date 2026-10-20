import { NextResponse, type NextRequest } from "next/server";
import { lookupBriefing } from "./lookup";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

/**
 * Public briefing lookup (S10). The token arrives in the POST body, never in a URL, so it can't
 * land in access logs or Referer headers.
 */
export async function POST(request: NextRequest) {
  const result = await lookupBriefing(request);
  if (result.status !== "ok") return result.response;
  return NextResponse.json({ status: "ok", snapshot: result.snapshot }, { headers: HEADERS });
}
