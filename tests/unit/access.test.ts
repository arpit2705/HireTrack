import { describe, expect, it } from "vitest";
import { decideAccess, type SessionInfo } from "@/lib/auth/access";

const verified = (role: SessionInfo["role"]): SessionInfo => ({
  userId: "u1",
  orgId: "o1",
  role,
  emailVerified: true,
});

const unverified: SessionInfo = { ...verified("recruiter"), emailVerified: false };

describe("decideAccess", () => {
  it("allows public paths without a session", () => {
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/opengraph-image", // unfurl scrapers fetch this anonymously
      "/api/auth/signup",
    ]) {
      expect(decideAccess(path, "GET", null).type).toBe("allow");
    }
    expect(decideAccess("/api/auth/signup", "POST", null).type).toBe("allow");
  });

  it("sends anonymous users to login for protected paths", () => {
    expect(decideAccess("/jobs", "GET", null).type).toBe("login");
    expect(decideAccess("/api/jobs", "GET", null).type).toBe("login");
  });

  it("blocks ALL writes until email is verified", () => {
    const decision = decideAccess("/api/jobs", "POST", unverified);
    expect(decision).toEqual({
      type: "forbidden",
      reason: "email_not_verified",
    });
    // reads are still allowed while unverified
    expect(decideAccess("/api/jobs", "GET", unverified).type).toBe("allow");
  });

  it("enforces the role matrix on API routes server-side", () => {
    expect(decideAccess("/api/jobs", "POST", verified("recruiter")).type).toBe(
      "allow",
    );
    expect(
      decideAccess("/api/jobs", "POST", verified("hiring_manager")).type,
    ).toBe("forbidden");
    expect(
      decideAccess("/api/jobs", "GET", verified("hiring_manager")).type,
    ).toBe("forbidden");
    expect(
      decideAccess("/api/users", "POST", verified("recruiter")).type,
    ).toBe("forbidden");
    expect(decideAccess("/api/users", "POST", verified("admin")).type).toBe(
      "allow",
    );
    expect(
      decideAccess("/api/analytics/funnel", "GET", verified("hiring_manager"))
        .type,
    ).toBe("forbidden");
  });

  it("scorecard submission is hiring-manager only (row-level check in handler)", () => {
    expect(
      decideAccess(
        "/api/interviews/abc/scorecard",
        "POST",
        verified("hiring_manager"),
      ).type,
    ).toBe("allow");
    expect(
      decideAccess("/api/interviews/abc/scorecard", "POST", verified("admin"))
        .type,
    ).toBe("forbidden");
  });

  it("default-denies unmapped API routes so new routes must be registered", () => {
    expect(
      decideAccess("/api/some-future-route", "GET", verified("admin")).type,
    ).toBe("forbidden");
  });

  it("enforces roles on the /jobs pages (ledger row)", () => {
    expect(decideAccess("/jobs", "GET", verified("recruiter")).type).toBe(
      "allow",
    );
    expect(decideAccess("/jobs/abc123", "GET", verified("admin")).type).toBe(
      "allow",
    );
    expect(decideAccess("/jobs", "GET", verified("hiring_manager")).type).toBe(
      "forbidden",
    );
    expect(
      decideAccess("/jobs/abc123", "GET", verified("hiring_manager")).type,
    ).toBe("forbidden");
    expect(decideAccess("/jobs", "GET", null).type).toBe("login");
  });

  it("enforces roles on the /candidates pages and resume download (ledger row)", () => {
    expect(decideAccess("/candidates", "GET", verified("recruiter")).type).toBe(
      "allow",
    );
    expect(
      decideAccess("/api/candidates/abc/resume", "GET", verified("recruiter"))
        .type,
    ).toBe("allow");
    expect(decideAccess("/candidates", "GET", null).type).toBe("login");
  });

  it("hiring managers get CONDITIONAL single-candidate access (row check in handler)", () => {
    const hm = verified("hiring_manager");
    // Reads on a specific candidate pass the proxy; handlers 403 without an
    // assigned interview (plan.md: 403, not a silent empty list).
    expect(decideAccess("/api/candidates/abc", "GET", hm).type).toBe("allow");
    expect(decideAccess("/api/candidates/abc/resume", "GET", hm).type).toBe(
      "allow",
    );
    expect(decideAccess("/candidates/abc", "GET", hm).type).toBe("allow");
    // Everything else about candidates stays closed to HMs.
    expect(decideAccess("/candidates", "GET", hm).type).toBe("forbidden");
    expect(decideAccess("/candidates/new", "GET", hm).type).toBe("forbidden");
    expect(decideAccess("/api/candidates", "GET", hm).type).toBe("forbidden");
    expect(decideAccess("/api/candidates/abc", "PATCH", hm).type).toBe(
      "forbidden",
    );
    expect(
      decideAccess("/api/candidates/abc/resume", "PUT", hm).type,
    ).toBe("forbidden");
  });

  it("interviews: viewing is all-roles, scheduling is recruiter+ (ledger rows)", () => {
    for (const role of ["admin", "recruiter", "hiring_manager"] as const) {
      expect(decideAccess("/interviews", "GET", verified(role)).type).toBe(
        "allow",
      );
      expect(decideAccess("/api/interviews", "GET", verified(role)).type).toBe(
        "allow",
      );
    }
    expect(
      decideAccess("/api/interviews", "POST", verified("recruiter")).type,
    ).toBe("allow");
    expect(
      decideAccess("/api/interviews", "POST", verified("hiring_manager")).type,
    ).toBe("forbidden");
    expect(
      decideAccess("/api/users/interviewers", "GET", verified("recruiter"))
        .type,
    ).toBe("allow");
    expect(
      decideAccess("/api/users/interviewers", "GET", verified("hiring_manager"))
        .type,
    ).toBe("forbidden");
    expect(decideAccess("/interviews", "GET", null).type).toBe("login");
  });

  it("scorecard form page is hiring-manager only", () => {
    expect(
      decideAccess("/interviews/abc/scorecard", "GET", verified("hiring_manager"))
        .type,
    ).toBe("allow");
    expect(
      decideAccess("/interviews/abc/scorecard", "GET", verified("admin")).type,
    ).toBe("forbidden");
    expect(
      decideAccess("/interviews/abc/scorecard", "GET", verified("recruiter"))
        .type,
    ).toBe("forbidden");
  });

  it("enforces roles on the /analytics page (ledger row)", () => {
    expect(decideAccess("/analytics", "GET", verified("admin")).type).toBe(
      "allow",
    );
    expect(decideAccess("/analytics", "GET", verified("recruiter")).type).toBe(
      "allow",
    );
    expect(
      decideAccess("/analytics", "GET", verified("hiring_manager")).type,
    ).toBe("forbidden");
    expect(decideAccess("/analytics", "GET", null).type).toBe("login");
  });

  it("settings page and org API are admin-only (final ledger row)", () => {
    expect(decideAccess("/settings", "GET", verified("admin")).type).toBe(
      "allow",
    );
    expect(decideAccess("/settings", "GET", verified("recruiter")).type).toBe(
      "forbidden",
    );
    expect(
      decideAccess("/settings", "GET", verified("hiring_manager")).type,
    ).toBe("forbidden");
    expect(decideAccess("/settings", "GET", null).type).toBe("login");
    expect(decideAccess("/api/org", "PATCH", verified("admin")).type).toBe(
      "allow",
    );
    expect(decideAccess("/api/org", "PATCH", verified("recruiter")).type).toBe(
      "forbidden",
    );
  });

  it("allows authenticated users onto unmapped app pages", () => {
    expect(decideAccess("/dashboard", "GET", verified("hiring_manager")).type).toBe(
      "allow",
    );
  });
});
