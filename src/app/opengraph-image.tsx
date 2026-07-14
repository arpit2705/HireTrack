import { ImageResponse } from "next/og";

// Generated OG image (1200x630) - self-contained, no external assets, so it
// works under the strict CSP and needs no design file in the repo.

export const alt = "HireTrack — lightweight applicant tracking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#a5b4fc",
          }}
        >
          HireTrack
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 950,
          }}
        >
          Hiring pipelines without the enterprise bloat
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 32,
            color: "#c7d2fe",
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          Jobs, Kanban pipelines, interview scorecards, and hiring analytics
          for small teams.
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: "12px",
          }}
        >
          {["Applied", "Screening", "Interview", "Offer", "Hired"].map(
            (stage) => (
              <div
                key={stage}
                style={{
                  padding: "12px 28px",
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  fontSize: 26,
                  color: "#e0e7ff",
                }}
              >
                {stage}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    size,
  );
}
