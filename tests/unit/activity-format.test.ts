import { describe, expect, it } from "vitest";
import { describeActivity } from "@/lib/activity/format";

describe("describeActivity", () => {
  it("stage moves read forward vs reverted", () => {
    expect(
      describeActivity("stage_updated", { from: "applied", to: "screening" }),
    ).toBe("Moved from applied to screening");
    expect(
      describeActivity("stage_reverted", { from: "offer", to: "interview" }),
    ).toBe("Moved back from offer to interview");
  });

  it("single rejection and bulk rejection are DISTINGUISHABLE", () => {
    expect(describeActivity("rejected", { reason: "Not a fit" })).toBe(
      "Rejected — Not a fit",
    );
    // Bulk entries carry batchId; with the batch size resolved they must
    // read as part of a bulk action, never like a one-off rejection.
    expect(
      describeActivity(
        "bulk_rejected",
        { reason: "Req closed", batchId: "b1" },
        { batchSize: 12 },
      ),
    ).toBe("Rejected as part of a bulk action of 12 — Req closed");
    // Even without the resolved count it must still say bulk.
    expect(
      describeActivity("bulk_rejected", { reason: "Req closed", batchId: "b1" }),
    ).toBe("Rejected as part of a bulk action — Req closed");
  });

  it("covers unreject, interviews, scorecards, users", () => {
    expect(describeActivity("unrejected", { stage: "screening" })).toBe(
      "Reinstated to screening",
    );
    expect(
      describeActivity("interview_scheduled", { type: "technical" }),
    ).toBe("Interview scheduled (technical)");
    expect(describeActivity("scorecard_submitted", { rating: 4 })).toBe(
      "Scorecard submitted (4/5)",
    );
    expect(describeActivity("user_role_changed", { from: "hiring_manager", to: "recruiter" })).toBe(
      "Role changed from hiring_manager to recruiter",
    );
  });

  it("falls back gracefully for unknown metadata shapes", () => {
    expect(describeActivity("created", {})).toBe("Created");
    expect(describeActivity("updated", null)).toBe("Updated");
  });
});
