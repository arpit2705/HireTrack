import { describe, expect, it } from "vitest";
import { activityActionSchema, bulkRejectSchema } from "@/lib/schemas";

describe("bulkRejectSchema", () => {
  it("accepts explicit application ids with a reason", () => {
    expect(
      bulkRejectSchema.safeParse({
        reason: "Position filled",
        applicationIds: ["a1", "a2"],
      }).success,
    ).toBe(true);
  });

  it("accepts a filter target (select-all-across-pages)", () => {
    expect(
      bulkRejectSchema.safeParse({
        reason: "Position filled",
        filter: { jobId: "j1", stage: "screening" },
      }).success,
    ).toBe(true);
    expect(
      bulkRejectSchema.safeParse({
        reason: "Position filled",
        filter: { jobId: "j1" },
      }).success,
    ).toBe(true);
  });

  it("REQUIRES a reason, exactly like single reject (400, no silent default)", () => {
    expect(
      bulkRejectSchema.safeParse({ applicationIds: ["a1"] }).success,
    ).toBe(false);
    expect(
      bulkRejectSchema.safeParse({ reason: " ", applicationIds: ["a1"] })
        .success,
    ).toBe(false);
  });

  it("requires exactly ONE target: ids or filter, not both, not neither", () => {
    expect(bulkRejectSchema.safeParse({ reason: "r-e-a-s-o-n" }).success).toBe(
      false,
    );
    expect(
      bulkRejectSchema.safeParse({
        reason: "r-e-a-s-o-n",
        applicationIds: ["a1"],
        filter: { jobId: "j1" },
      }).success,
    ).toBe(false);
  });

  it("rejects empty id lists and stage smuggling in the filter", () => {
    expect(
      bulkRejectSchema.safeParse({ reason: "reason", applicationIds: [] })
        .success,
    ).toBe(false);
    expect(
      bulkRejectSchema.safeParse({
        reason: "reason",
        filter: { jobId: "j1", orgId: "o2" },
      }).success,
    ).toBe(false);
  });
});

describe("activity actions", () => {
  it("has a distinct unrejected action (audit contract)", () => {
    expect(activityActionSchema.safeParse("unrejected").success).toBe(true);
  });
});
