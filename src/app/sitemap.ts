import type { MetadataRoute } from "next";

// Only the public marketing/auth surface belongs in the sitemap - the app
// itself is session-gated and disallowed in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
