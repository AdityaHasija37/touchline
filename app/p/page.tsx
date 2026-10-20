import type { Metadata } from "next";
import { PublicBriefing } from "@/components/publish/public-briefing";

export const metadata: Metadata = {
  title: "Matchday briefing · Touchline",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** S10 public share. The token lives in the URL fragment and is only ever sent in a POST body. */
export default function PublicBriefingPage() {
  return <PublicBriefing />;
}
