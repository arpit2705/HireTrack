import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FOR_MOVE,
  classifyStageMove,
  revivalPatch,
  validTargetsFor,
} from "@/lib/applications/stage-moves";

describe("classifyStageMove", () => {
  it("forward moves, including jumps, are 'forward'", () => {
    expect(classifyStageMove("applied", "screening")).toBe("forward");
    expect(classifyStageMove("applied", "offer")).toBe("forward"); // jump ok
    expect(classifyStageMove("offer", "hired")).toBe("forward");
  });

  it("exactly one stage back is 'backward'", () => {
    expect(classifyStageMove("screening", "applied")).toBe("backward");
    expect(classifyStageMove("offer", "interview")).toBe("backward");
  });

  it("same stage and multi-stage backward are 'invalid'", () => {
    expect(classifyStageMove("screening", "screening")).toBe("invalid");
    expect(classifyStageMove("offer", "applied")).toBe("invalid");
    expect(classifyStageMove("hired", "screening")).toBe("invalid");
  });

  it("maps moves to the correct activity actions (analytics contract)", () => {
    // Backward moves MUST log stage_reverted so milestone-8 time-to-hire
    // can exclude reverted time without a data migration.
    expect(ACTIVITY_FOR_MOVE.forward).toBe("stage_updated");
    expect(ACTIVITY_FOR_MOVE.backward).toBe("stage_reverted");
  });
});

describe("validTargetsFor", () => {
  it("is consistent with classifyStageMove", () => {
    expect(validTargetsFor("applied")).toEqual([
      "screening",
      "interview",
      "offer",
      "hired",
    ]);
    expect(validTargetsFor("interview")).toEqual([
      "screening",
      "offer",
      "hired",
    ]);
    expect(validTargetsFor("hired")).toEqual(["offer"]);
  });
});

describe("revivalPatch (re-application after soft delete)", () => {
  const now = new Date("2026-07-12T10:00:00.000Z");

  it("clears deletion AND rejection state, resetting to applied", () => {
    expect(revivalPatch(now)).toEqual({
      deletedAt: null,
      rejectedAt: null,
      rejectedReason: null,
      stage: "applied",
      stageUpdatedAt: now,
    });
  });
});
