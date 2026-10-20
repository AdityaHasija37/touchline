import { NextResponse, type NextRequest } from "next/server";
import { lookupBriefing } from "../lookup";
import { pdfFilename, renderBriefingPdf } from "@/lib/pdf/briefing-pdf";

export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

/** EXP-01 player export: token in the POST body (never a URL), same rate limit as viewing (DEC-11). */
export async function POST(request: NextRequest) {
  const result = await lookupBriefing(request, "pdf");
  if (result.status !== "ok") return result.response;
  const pdf = await renderBriefingPdf(result.snapshot);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { ...HEADERS, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdfFilename(result.snapshot)}"` },
  });
}
