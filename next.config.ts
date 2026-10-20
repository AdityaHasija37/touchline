import type { NextConfig } from "next";

const privateHeaders = [
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // react-pdf uses Node APIs and native-ish font handling; keep it out of the server bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // The PDF routes read the embedded font files at runtime; ship them with those functions.
  outputFileTracingIncludes: {
    "/api/plans/[planId]/pdf": ["./assets/fonts/**"],
    "/api/briefing/pdf": ["./assets/fonts/**"],
  },
  async headers() {
    return [
      { source: "/p", headers: privateHeaders },
      { source: "/api/briefing", headers: privateHeaders },
      { source: "/api/briefing/pdf", headers: privateHeaders },
      { source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
