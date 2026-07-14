import type { ReactNode } from "react";

// Per-page SVG illustrations for empty states.
// Each illustration uses brand palette colors and a slow float animation.
// All animations are disabled via globals.css when prefers-reduced-motion: reduce.

/** Jobs: stack of floating rounded cards */
export function JobsIllustration() {
  return (
    <svg
      width="140"
      height="120"
      viewBox="0 0 140 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="animate-illus-float"
    >
      {/* Back card */}
      <rect x="20" y="30" width="88" height="56" rx="10" fill="#E8E6FF" stroke="#C8C6E0" strokeWidth="1.5" />
      {/* Middle card */}
      <rect x="14" y="20" width="88" height="56" rx="10" fill="#EEF0FF" stroke="#C8C6E0" strokeWidth="1.5" />
      {/* Lines on middle card */}
      <rect x="26" y="34" width="48" height="4" rx="2" fill="#C8C6E0" />
      <rect x="26" y="44" width="36" height="4" rx="2" fill="#E3E1F5" />
      {/* Front card */}
      <rect x="8" y="10" width="88" height="56" rx="10" fill="white" stroke="#E3E1F5" strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 4px 12px rgb(79 70 229 / 0.12))" }} />
      {/* Lines on front card */}
      <rect x="20" y="26" width="52" height="5" rx="2.5" fill="#4F46E5" opacity="0.7" />
      <rect x="20" y="37" width="40" height="4" rx="2" fill="#C8C6E0" />
      <rect x="20" y="47" width="32" height="4" rx="2" fill="#E3E1F5" />
      {/* Status pill */}
      <rect x="20" y="56" width="28" height="6" rx="3" fill="#22C55E" opacity="0.3" />
      <circle cx="26" cy="59" r="2" fill="#22C55E" />
      {/* Floating sparkle */}
      <circle cx="110" cy="18" r="4" fill="#FF7A59" opacity="0.5" />
      <circle cx="120" cy="40" r="2.5" fill="#4F46E5" opacity="0.4" />
      <circle cx="106" cy="55" r="2" fill="#E8E6FF" stroke="#C8C6E0" strokeWidth="1" />
    </svg>
  );
}

/** Candidates: floating avatar blobs */
export function CandidatesIllustration() {
  return (
    <svg
      width="140"
      height="120"
      viewBox="0 0 140 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="animate-illus-float"
    >
      {/* Avatar 1 — large, center */}
      <circle cx="70" cy="52" r="28" fill="#E8E6FF" stroke="#C8C6E0" strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 4px 12px rgb(79 70 229 / 0.14))" }} />
      <circle cx="70" cy="44" r="11" fill="#C8C6E0" />
      <ellipse cx="70" cy="66" rx="18" ry="10" fill="#C8C6E0" opacity="0.6" />
      {/* Avatar 2 — small, left */}
      <circle cx="30" cy="68" r="18" fill="#EEF0FF" stroke="#C8C6E0" strokeWidth="1.5"
        style={{ animationDelay: "-1s" }} />
      <circle cx="30" cy="62" r="7" fill="#E3E1F5" />
      <ellipse cx="30" cy="77" rx="11" ry="7" fill="#E3E1F5" opacity="0.6" />
      {/* Avatar 3 — small, right */}
      <circle cx="112" cy="62" r="18" fill="#FFF5F2" stroke="#FFD5C8" strokeWidth="1.5"
        style={{ animationDelay: "-2.5s" }} />
      <circle cx="112" cy="56" r="7" fill="#FFD5C8" />
      <ellipse cx="112" cy="71" rx="11" ry="7" fill="#FFD5C8" opacity="0.6" />
      {/* Decorative dots */}
      <circle cx="55" cy="15" r="3.5" fill="#4F46E5" opacity="0.3" />
      <circle cx="90" cy="20" r="2.5" fill="#FF7A59" opacity="0.4" />
      <circle cx="18" cy="45" r="2" fill="#22C55E" opacity="0.5" />
    </svg>
  );
}

/** Interviews: floating calendar with clock */
export function InterviewsIllustration() {
  return (
    <svg
      width="140"
      height="120"
      viewBox="0 0 140 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="animate-illus-float"
    >
      {/* Calendar body */}
      <rect x="22" y="22" width="80" height="76" rx="12" fill="white" stroke="#E3E1F5" strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 4px 12px rgb(79 70 229 / 0.10))" }} />
      {/* Calendar header */}
      <rect x="22" y="22" width="80" height="26" rx="12" fill="#4F46E5" />
      <rect x="22" y="36" width="80" height="12" fill="#4F46E5" />
      {/* Calendar hook left */}
      <rect x="38" y="14" width="5" height="16" rx="2.5" fill="#4F46E5" opacity="0.7" />
      {/* Calendar hook right */}
      <rect x="81" y="14" width="5" height="16" rx="2.5" fill="#4F46E5" opacity="0.7" />
      {/* Date dots grid */}
      {[44, 56, 68, 80].map((y, ri) =>
        [34, 50, 66, 82].map((x, ci) => (
          <rect
            key={`${ri}-${ci}`}
            x={x} y={y} width="8" height="8" rx="2"
            fill={ri === 1 && ci === 1 ? "#FF7A59" : "#E8E6FF"}
          />
        ))
      )}
      {/* Floating clock badge */}
      <circle cx="96" cy="86" r="18" fill="white" stroke="#E3E1F5" strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 2px 8px rgb(79 70 229 / 0.12))" }} />
      <circle cx="96" cy="86" r="13" fill="#F5F4FF" />
      {/* Clock hands */}
      <line x1="96" y1="86" x2="96" y2="77" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
      <line x1="96" y1="86" x2="102" y2="89" stroke="#FF7A59" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="96" cy="86" r="2" fill="#4F46E5" />
      {/* Decorative dots */}
      <circle cx="18" cy="30" r="3" fill="#FF7A59" opacity="0.4" />
      <circle cx="118" cy="24" r="2.5" fill="#4F46E5" opacity="0.3" />
    </svg>
  );
}

/** Analytics: animated rising bar chart */
export function AnalyticsIllustration() {
  return (
    <svg
      width="140"
      height="120"
      viewBox="0 0 140 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Chart base line */}
      <line x1="22" y1="96" x2="122" y2="96" stroke="#E3E1F5" strokeWidth="1.5" strokeLinecap="round" />
      {/* Grid lines */}
      <line x1="22" y1="76" x2="122" y2="76" stroke="#E8E6FF" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="22" y1="56" x2="122" y2="56" stroke="#E8E6FF" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="22" y1="36" x2="122" y2="36" stroke="#E8E6FF" strokeWidth="1" strokeDasharray="4 3" />
      {/* Bar 1 */}
      <rect x="34" y="62" width="18" height="34" rx="4" fill="#E8E6FF" stroke="#C8C6E0" strokeWidth="1"
        style={{
          transformOrigin: "34px 96px",
          animation: "bar-rise 1.2s ease-out 0.1s both",
        }} />
      {/* Bar 2 */}
      <rect x="60" y="40" width="18" height="56" rx="4" fill="#4F46E5" opacity="0.85"
        style={{
          transformOrigin: "60px 96px",
          animation: "bar-rise 1.2s ease-out 0.3s both",
        }} />
      {/* Bar 3 */}
      <rect x="86" y="52" width="18" height="44" rx="4" fill="#A78BFA" opacity="0.7"
        style={{
          transformOrigin: "86px 96px",
          animation: "bar-rise 1.2s ease-out 0.5s both",
        }} />
      {/* Floating dot on highest bar */}
      <circle cx="69" cy="36" r="5" fill="white" stroke="#4F46E5" strokeWidth="2"
        style={{ animation: "illus-float 3s ease-in-out infinite" }} />
      {/* Decorative */}
      <circle cx="118" cy="30" r="3" fill="#FF7A59" opacity="0.5" />
      <circle cx="22" cy="48" r="2.5" fill="#22C55E" opacity="0.5" />
    </svg>
  );
}

// ─── EmptyState wrapper ───────────────────────────────────────────────────────

interface EmptyStateProps {
  illustration: ReactNode;
  heading: string;
  subtext: string;
  action?: ReactNode;
}

export function EmptyState({
  illustration,
  heading,
  subtext,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[#C8C6E0] bg-white/60 backdrop-blur-sm p-14 text-center shadow-card">
      <div className="flex justify-center mb-5">{illustration}</div>
      <p className="font-grotesk text-xl font-semibold text-foreground">{heading}</p>
      <p className="mt-2 max-w-sm mx-auto text-sm text-muted-foreground leading-relaxed">
        {subtext}
      </p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}
