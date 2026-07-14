import type { NextConfig } from "next";

// The Content-Security-Policy header is set per-request in src/proxy.ts
// with a script nonce (milestone-12 CSP experiment, kept). The static
// headers below apply on top.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No X-Frame-Options: CSP frame-ancestors 'none' supersedes it, and
  // sending both makes Chrome log a DevTools CSP issue (measured: it was
  // the Best-Practices 96 deduction).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
