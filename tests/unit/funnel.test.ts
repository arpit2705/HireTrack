import { describe, expect, it } from "vitest";
import { funnelCounts } from "@/lib/analytics/funnel";

describe("funnelCounts", () => {
  it("counts reached-per-stage using preserved stage-rejected-from", () => {
    const apps = [
      { stage: "hired", rejectedAt: null },
      { stage: "offer", rejectedAt: null },
      // Rejected FROM interview: stage was preserved at rejection, so this
      // application reached applied/screening/interview and counts AGAINST
      // interview's conversion - it is NOT silently excluded.
      { stage: "interview", rejectedAt: new Date() },
      { stage: "screening", rejectedAt: null },
      { stage: "applied", rejectedAt: null },
    ] as const;

    const funnel = funnelCounts([...apps]);

    expect(funnel.map((s) => [s.stage, s.reached])).toEqual([
      ["applied", 5],
      ["screening", 4],
      ["interview", 3],
      ["offer", 2],
      ["hired", 1],
    ]);

    const interview = funnel.find((s) => s.stage === "interview");
    expect(interview?.rejectedHere).toBe(1);
    // interview -> offer conversion: 2 of 3 who reached interview went on.
    expect(interview?.conversionToNext).toBeCloseTo(2 / 3);
  });

  it("handles an empty pipeline", () => {
    const funnel = funnelCounts([]);
    expect(funnel).toHaveLength(5);
    expect(funnel[0]).toMatchObject({
      stage: "applied",
      reached: 0,
      conversionToNext: null,
    });
  });
});
