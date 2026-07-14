"use client";

// Last-resort boundary: catches crashes in the ROOT LAYOUT itself, so it
// must render its own <html>/<body> and use zero app components.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          gap: "16px",
          padding: "16px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 600 }}>
          HireTrack failed to load
        </h1>
        <p style={{ color: "#52525b", maxWidth: "28rem", textAlign: "center" }}>
          Something broke before the page could render.
          {error.digest ? ` (Error reference: ${error.digest})` : ""}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            height: "44px",
            padding: "0 24px",
            borderRadius: "8px",
            border: "none",
            background: "#4f46e5",
            color: "#fff",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
