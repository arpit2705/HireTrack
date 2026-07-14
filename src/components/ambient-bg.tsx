"use client";

// Ambient gradient blob layer — rendered fixed behind all page content.
// Three large radial-gradient blobs slowly drift using CSS keyframe animations.
// pointer-events: none ensures zero interaction interference.
// The grain overlay lives in globals.css (body::before) at z-index: 1.
// prefers-reduced-motion is handled in globals.css via @media query.

export function AmbientBg() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
    >
      {/* Blob 1 — signal violet, top-left. Responsive width/height scaling with screen size */}
      <div
        className="animate-blob-1 absolute -top-40 -left-40 h-[60vw] w-[60vw] min-h-[500px] min-w-[500px] max-h-[1000px] max-w-[1000px] rounded-full opacity-[0.14]"
        style={{
          background:
            "radial-gradient(circle at center, #4F46E5 0%, #7C6FF7 40%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Blob 2 — warm coral, bottom-right. Responsive width/height */}
      <div
        className="animate-blob-2 absolute -bottom-32 -right-32 h-[55vw] w-[55vw] min-h-[450px] min-w-[450px] max-h-[900px] max-w-[900px] rounded-full opacity-[0.11]"
        style={{
          background:
            "radial-gradient(circle at center, #FF7A59 0%, #FFB59A 40%, transparent 70%)",
          filter: "blur(90px)",
          animationDelay: "-8s",
        }}
      />

      {/* Blob 3 — pale lavender, center-right. Responsive width/height */}
      <div
        className="animate-blob-3 absolute top-1/3 right-1/4 h-[45vw] w-[45vw] min-h-[400px] min-w-[400px] max-h-[800px] max-w-[800px] rounded-full opacity-[0.16]"
        style={{
          background:
            "radial-gradient(circle at center, #A78BFA 0%, #E8E6FF 50%, transparent 70%)",
          filter: "blur(72px)",
          animationDelay: "-15s",
        }}
      />
    </div>
  );
}
