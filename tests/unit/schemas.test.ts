import { describe, expect, it } from "vitest";
import {
  PIPELINE_STAGES,
  applicationSchema,
  candidateSchema,
  roleSchema,
  scorecardSchema,
  stageSchema,
} from "@/lib/schemas";

const baseApplication = {
  id: "app_1",
  jobId: "job_1",
  candidateId: "cand_1",
  stage: "screening",
  stageUpdatedAt: "2026-07-12T10:00:00.000Z",
  rejectedAt: null,
  rejectedReason: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-12T10:00:00.000Z",
  deletedAt: null,
};

describe("applicationSchema", () => {
  it("accepts a non-rejected application without a rejection reason", () => {
    expect(applicationSchema.safeParse(baseApplication).success).toBe(true);
  });

  it("rejects rejectedAt set without a rejection reason", () => {
    const result = applicationSchema.safeParse({
      ...baseApplication,
      rejectedAt: "2026-07-12T11:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["rejectedReason"]);
    }
  });

  it("rejects a rejection reason without rejectedAt (symmetric constraint)", () => {
    const result = applicationSchema.safeParse({
      ...baseApplication,
      rejectedReason: "Ghosted us",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["rejectedReason"]);
    }
  });

  it("rejects rejectedAt set with a whitespace-only reason", () => {
    const result = applicationSchema.safeParse({
      ...baseApplication,
      rejectedAt: "2026-07-12T11:00:00.000Z",
      rejectedReason: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a rejection with a reason, at any stage", () => {
    for (const stage of PIPELINE_STAGES) {
      const result = applicationSchema.safeParse({
        ...baseApplication,
        stage,
        rejectedAt: "2026-07-12T11:00:00.000Z",
        rejectedReason: "Not enough experience with distributed systems",
      });
      expect(result.success).toBe(true);
    }
  });

  it("coerces ISO timestamp strings to Date", () => {
    const parsed = applicationSchema.parse(baseApplication);
    expect(parsed.stageUpdatedAt).toBeInstanceOf(Date);
  });
});

describe("scorecardSchema", () => {
  const baseScorecard = {
    id: "sc_1",
    interviewId: "int_1",
    submittedById: "user_1",
    rating: 4,
    recommendation: "yes",
    notes: "Strong on systems design, weaker on frontend.",
    createdAt: "2026-07-12T10:00:00.000Z",
  };

  it("accepts ratings 1 through 5", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(
        scorecardSchema.safeParse({ ...baseScorecard, rating }).success,
      ).toBe(true);
    }
  });

  it.each([0, 6, 3.5])("rejects rating %s", (rating) => {
    expect(
      scorecardSchema.safeParse({ ...baseScorecard, rating }).success,
    ).toBe(false);
  });

  it("rejects empty notes", () => {
    expect(
      scorecardSchema.safeParse({ ...baseScorecard, notes: "" }).success,
    ).toBe(false);
  });
});

describe("candidateSchema", () => {
  const baseCandidate = {
    id: "cand_1",
    orgId: "org_1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: null,
    resumeUrl: null,
    source: null,
    tags: ["backend"],
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
  };

  it("accepts a valid candidate", () => {
    expect(candidateSchema.safeParse(baseCandidate).success).toBe(true);
  });

  it("requires email (dedupe key), rejecting null", () => {
    expect(
      candidateSchema.safeParse({ ...baseCandidate, email: null }).success,
    ).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      candidateSchema.safeParse({ ...baseCandidate, email: "not-an-email" })
        .success,
    ).toBe(false);
  });
});

describe("enums", () => {
  it("rejects unknown roles", () => {
    expect(roleSchema.safeParse("superadmin").success).toBe(false);
  });

  it("no longer accepts rejected as a stage value", () => {
    expect(PIPELINE_STAGES).not.toContain("rejected");
    expect(stageSchema.safeParse("rejected").success).toBe(false);
  });
});
