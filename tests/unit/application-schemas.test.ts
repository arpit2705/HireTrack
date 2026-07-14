import { describe, expect, it } from "vitest";
import {
  applicationCreateSchema,
  rejectApplicationSchema,
  stageMoveSchema,
} from "@/lib/schemas";

describe("applicationCreateSchema", () => {
  it("requires jobId and candidateId, nothing else", () => {
    expect(
      applicationCreateSchema.safeParse({ jobId: "j1", candidateId: "c1" })
        .success,
    ).toBe(true);
    expect(applicationCreateSchema.safeParse({ jobId: "j1" }).success).toBe(
      false,
    );
  });

  it("REJECTS stage/orgId smuggling on create", () => {
    expect(
      applicationCreateSchema.safeParse({
        jobId: "j1",
        candidateId: "c1",
        stage: "hired",
      }).success,
    ).toBe(false);
    expect(
      applicationCreateSchema.safeParse({
        jobId: "j1",
        candidateId: "c1",
        orgId: "org2",
      }).success,
    ).toBe(false);
  });
});

describe("stageMoveSchema", () => {
  it("accepts pipeline stages only", () => {
    expect(stageMoveSchema.safeParse({ stage: "interview" }).success).toBe(
      true,
    );
    // rejection is NOT a stage move - it has its own endpoint and reason
    expect(stageMoveSchema.safeParse({ stage: "rejected" }).success).toBe(
      false,
    );
  });
});

describe("rejectApplicationSchema", () => {
  it("requires a non-empty reason (client- and server-side)", () => {
    expect(
      rejectApplicationSchema.safeParse({ reason: "Not enough experience" })
        .success,
    ).toBe(true);
    expect(rejectApplicationSchema.safeParse({ reason: "" }).success).toBe(
      false,
    );
    expect(rejectApplicationSchema.safeParse({ reason: "  " }).success).toBe(
      false,
    );
    expect(rejectApplicationSchema.safeParse({}).success).toBe(false);
  });
});
