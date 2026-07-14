import { describe, expect, it } from "vitest";
import {
  applyJobStatusChange,
  canChangeJobStatus,
} from "@/lib/jobs/status";

const now = new Date("2026-07-12T10:00:00.000Z");

describe("job status transitions", () => {
  it.each([
    ["draft", "open", true],
    ["draft", "closed", true],
    ["open", "closed", true],
    ["closed", "open", true], // reopen
    ["open", "draft", false], // cannot unpublish
    ["closed", "draft", false],
    ["draft", "draft", false], // no-op is not a change
    ["open", "open", false],
    ["closed", "closed", false],
  ] as const)("%s -> %s allowed=%s", (from, to, allowed) => {
    expect(canChangeJobStatus(from, to)).toBe(allowed);
  });

  it("closing stamps closedAt", () => {
    expect(applyJobStatusChange("closed", now)).toEqual({
      status: "closed",
      closedAt: now,
    });
  });

  it("reopening clears closedAt", () => {
    expect(applyJobStatusChange("open", now)).toEqual({
      status: "open",
      closedAt: null,
    });
  });
});
