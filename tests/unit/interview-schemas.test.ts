import { describe, expect, it } from "vitest";
import { interviewCreateSchema, scorecardCreateSchema } from "@/lib/schemas";

describe("interviewCreateSchema", () => {
  const valid = {
    applicationId: "app1",
    interviewerId: "user1",
    scheduledAt: "2026-08-01T14:00:00.000Z",
    type: "technical",
  };

  it("accepts a valid interview and coerces the timestamp", () => {
    const parsed = interviewCreateSchema.parse(valid);
    expect(parsed.scheduledAt).toBeInstanceOf(Date);
  });

  it("REQUIRES interviewerId - a scheduled interview with no interviewer is a bug (plan.md section 3)", () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.interviewerId;
    expect(interviewCreateSchema.safeParse(rest).success).toBe(false);
    expect(
      interviewCreateSchema.safeParse({ ...valid, interviewerId: "" }).success,
    ).toBe(false);
  });

  it("rejects unknown types and smuggled fields", () => {
    expect(
      interviewCreateSchema.safeParse({ ...valid, type: "trial_day" }).success,
    ).toBe(false);
    expect(
      interviewCreateSchema.safeParse({ ...valid, status: "completed" })
        .success,
    ).toBe(false);
  });
});

describe("scorecardCreateSchema", () => {
  const valid = {
    rating: 4,
    recommendation: "yes",
    notes: "Solid systems thinking; communication could be sharper.",
  };

  it("accepts a valid scorecard", () => {
    expect(scorecardCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces 1-5 integer rating and required notes", () => {
    expect(
      scorecardCreateSchema.safeParse({ ...valid, rating: 0 }).success,
    ).toBe(false);
    expect(
      scorecardCreateSchema.safeParse({ ...valid, rating: 3.5 }).success,
    ).toBe(false);
    expect(
      scorecardCreateSchema.safeParse({ ...valid, notes: "  " }).success,
    ).toBe(false);
  });

  it("REJECTS submittedById/interviewId smuggling - both come from the session and URL", () => {
    expect(
      scorecardCreateSchema.safeParse({ ...valid, submittedById: "u9" })
        .success,
    ).toBe(false);
    expect(
      scorecardCreateSchema.safeParse({ ...valid, interviewId: "i9" }).success,
    ).toBe(false);
  });
});
