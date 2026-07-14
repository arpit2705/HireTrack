import { describe, expect, it } from "vitest";
import {
  timeToHireMs,
  underwaterMs,
  type StageEvent,
} from "@/lib/analytics/time-to-hire";

const DAY = 24 * 60 * 60 * 1000;
const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));

// The EXACT worked example from docs/architecture.md "Time-to-hire
// methodology". If this test and the doc ever disagree, the doc wins and
// this implementation is wrong.
const workedExample: StageEvent[] = [
  { action: "stage_updated", to: "screening", at: day(2) },
  { action: "stage_updated", to: "offer", at: day(5) }, // forward jump
  { action: "stage_reverted", to: "interview", at: day(7) },
  { action: "stage_updated", to: "offer", at: day(10) },
  { action: "stage_updated", to: "hired", at: day(12) },
];

describe("time-to-hire excluding reverted (underwater) time", () => {
  it("doc worked example: naive 12d, underwater 3d, TTH 9d", () => {
    expect(underwaterMs(day(0), workedExample)).toBe(3 * DAY);
    expect(timeToHireMs(day(0), workedExample)).toBe(9 * DAY);
  });

  it("doc variant: revert immediately preceding the hire -> 7d", () => {
    const events: StageEvent[] = [
      { action: "stage_updated", to: "screening", at: day(2) },
      { action: "stage_updated", to: "offer", at: day(5) },
      { action: "stage_reverted", to: "interview", at: day(7) },
      { action: "stage_updated", to: "hired", at: day(10) }, // jump past max
    ];
    expect(underwaterMs(day(0), events)).toBe(3 * DAY);
    expect(timeToHireMs(day(0), events)).toBe(7 * DAY);
  });

  it("no reverts: TTH equals naive elapsed", () => {
    const events: StageEvent[] = [
      { action: "stage_updated", to: "screening", at: day(3) },
      { action: "stage_updated", to: "hired", at: day(8) },
    ];
    expect(timeToHireMs(day(0), events)).toBe(8 * DAY);
  });

  it("multiple reverts each contribute underwater time", () => {
    const events: StageEvent[] = [
      { action: "stage_updated", to: "screening", at: day(1) },
      { action: "stage_reverted", to: "applied", at: day(2) },
      { action: "stage_updated", to: "screening", at: day(4) }, // 2d underwater
      { action: "stage_updated", to: "offer", at: day(6) },
      { action: "stage_reverted", to: "interview", at: day(7) },
      { action: "stage_updated", to: "offer", at: day(9) }, // 2d underwater
      { action: "stage_updated", to: "hired", at: day(10) },
    ];
    expect(underwaterMs(day(0), events)).toBe(4 * DAY);
    expect(timeToHireMs(day(0), events)).toBe(6 * DAY);
  });

  it("time re-spent AT the regained frontier counts (only below-max is excluded)", () => {
    const events: StageEvent[] = [
      { action: "stage_updated", to: "offer", at: day(4) },
      { action: "stage_reverted", to: "interview", at: day(5) },
      { action: "stage_updated", to: "offer", at: day(6) }, // 1d underwater
      // 4 further days AT offer (the frontier) before hire - all counted
      { action: "stage_updated", to: "hired", at: day(10) },
    ];
    expect(timeToHireMs(day(0), events)).toBe(9 * DAY);
  });

  it("returns null when the trail never reaches hired", () => {
    expect(
      timeToHireMs(day(0), [
        { action: "stage_updated", to: "screening", at: day(2) },
      ]),
    ).toBeNull();
  });
});
