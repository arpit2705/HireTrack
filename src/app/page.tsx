import { headers } from "next/headers";
import Link from "next/link";
import { LivingPipelineSceneClient } from "@/components/living-pipeline-scene-client";

// SoftwareApplication JSON-LD (a Google rich-result-eligible type).
// Values are static/first-party only - nothing user-generated is injected.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "HireTrack",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Applicant tracking for small hiring teams: pipeline management, interview scorecards, and hiring analytics without the enterprise bloat.",
  url: process.env.APP_URL ?? "http://localhost:3000",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const MARQUEE_ITEMS = [
  "Jobs",
  "Candidates",
  "Scorecards",
  "Interviews",
  "Analytics",
  "Pipeline",
  "Hiring",
  "Structured",
  "Jobs",
  "Candidates",
  "Scorecards",
  "Interviews",
  "Analytics",
  "Pipeline",
  "Hiring",
  "Structured",
];

export default async function LandingPage() {
  // The JSON-LD inline script needs the per-request CSP nonce (this also
  // makes the landing dynamic - a measured, accepted cost of nonce CSP).\
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-4">
      <script
        type="application/ld+json"
        nonce={nonce}
        // suppressHydrationWarning: browsers clear the nonce attribute from the
        // DOM after reading it (CSP security measure), so the server-rendered
        // nonce value never matches the client DOM — this mismatch is expected
        // and safe to suppress.
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Living pipeline scene — absolute inset, z=0, pointer-events none */}
      <LivingPipelineSceneClient />

      {/*
        Blur overlay — sits at z=5, between the canvas (z=0) and text (z=10).
        It covers the central text zone and applies backdrop-filter: blur so
        cards passing behind the text block are visually softened, while the
        text content above (z=10) stays perfectly sharp.
        The background is nearly transparent so it doesn't tint the scene.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-[5]"
        style={{
          // Roughly covers max-w-3xl centered text block + generous padding
          inset: "12% 18%",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          borderRadius: "32px",
          // Very faint warm tint so text background isn't fully glassy
          background: "rgba(250, 250, 248, 0.08)",
          // Soft edge so the blur doesn't hard-clip
          maskImage:
            "radial-gradient(ellipse 90% 90% at 50% 50%, black 55%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 90% at 50% 50%, black 55%, transparent 100%)",
        }}
      />

      {/* Hero content — z=10, sits above both canvas and blur overlay */}
      <div className="relative z-10 w-full max-w-3xl text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E3E1F5] bg-white/80 px-4 py-1.5 backdrop-blur-sm mb-6">
          <span className="size-2 rounded-full bg-[#4F46E5] animate-pulse" />
          <span className="font-jetbrains text-xs font-semibold uppercase tracking-widest text-primary">
            HireTrack
          </span>
        </div>

        {/* Main heading
            Three explicit lines so the underline always sits under line 1
            and "bloat" is always alone on line 3, centered with the block. */}
        <h1 className="font-grotesk text-6xl font-bold tracking-tight text-foreground md:text-7xl">
          {/* Line 1 — underline decoration anchored here only */}
          <span className="relative inline-block leading-[1.15]">
            Hiring pipelines
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#4F46E5] to-[#FF7A59]"
            />
          </span>
          <br />
          {/* Line 2 */}
          <span className="leading-[1.15]">without the enterprise</span>
          <br />
          {/* Line 3 — gradient word, centered naturally with the block */}
          <span
            className="leading-[1.15] bg-gradient-to-r from-[#4F46E5] to-[#7C6FF7] bg-clip-text text-transparent"
          >
            bloat
          </span>
        </h1>

        {/* Subtext */}
        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Post jobs, move candidates through a visual pipeline, run structured
          interview scorecards, and see where every req is stuck.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            id="landing-cta-signup"
            className={[
              "inline-flex h-12 items-center rounded-xl bg-primary px-8 text-base font-semibold text-white font-grotesk",
              "shadow-primary-glow",
              "transition-all duration-150 ease-out",
              "hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-primary-glow-hover",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              "active:translate-y-0",
            ].join(" ")}
          >
            Create your organization
          </Link>
          <Link
            href="/login"
            id="landing-cta-login"
            className={[
              "inline-flex h-12 items-center rounded-xl border border-[#E3E1F5] bg-white/80 px-8 text-base font-medium text-foreground",
              "backdrop-blur-sm",
              "transition-all duration-150 ease-out",
              "hover:border-[#C8C6E0] hover:bg-white hover:-translate-y-0.5 hover:shadow-card",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              "active:translate-y-0",
            ].join(" ")}
          >
            Log in
          </Link>
        </div>

        {/* Social proof blip */}
        <p className="mt-8 text-xs text-muted-foreground font-jetbrains">
          Free to use · No credit card required
        </p>
      </div>

      {/* Feature marquee strip
          pl-10 gives clearance for any bottom-left fixed UI (e.g. browser
          devtools badge, ambient icon). Left fade-mask hides the hard start
          edge so scrolling looks clean from any starting position. */}
      <div className="absolute bottom-0 left-0 right-0 z-10 overflow-hidden border-t border-[#E3E1F5] bg-white/70 backdrop-blur-sm py-3">
        {/* Left fade mask — fades in the first 48px so the strip never
            hard-clips against a bottom-left icon or scrollbar gutter */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white/70 to-transparent"
        />
        {/* Right fade mask — symmetrical */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white/70 to-transparent"
        />
        <div className="flex w-max animate-marquee items-center gap-0 pl-12">
          {MARQUEE_ITEMS.map((item, i) => (
            <span key={i} className="flex items-center gap-0">
              <span className="font-jetbrains text-xs font-medium uppercase tracking-widest text-muted-foreground px-5">
                {item}
              </span>
              <span className="text-[#C8C6E0] text-xs" aria-hidden="true">
                ·
              </span>
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
