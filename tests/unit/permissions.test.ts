import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/permissions";

// Every row of the plan.md section 5 role permission matrix, including the
// deliberate negatives (admin cannot submit scorecards).
describe("role permission matrix", () => {
  it.each([
    ["job:manage", { admin: true, recruiter: true, hiring_manager: false }],
    ["job:view", { admin: true, recruiter: true, hiring_manager: false }],
    [
      "candidate:view_all",
      { admin: true, recruiter: true, hiring_manager: false },
    ],
    // HM passes the proxy for single-candidate reads; the handler then
    // requires an assigned interview (row-level) or answers 403.
    [
      "candidate:view_one",
      { admin: true, recruiter: true, hiring_manager: true },
    ],
    [
      "interview:view",
      { admin: true, recruiter: true, hiring_manager: true },
    ],
    [
      "application:move_stage",
      { admin: true, recruiter: true, hiring_manager: false },
    ],
    [
      "interview:schedule",
      { admin: true, recruiter: true, hiring_manager: false },
    ],
    [
      "scorecard:submit",
      { admin: false, recruiter: false, hiring_manager: true },
    ],
    ["bulk:act", { admin: true, recruiter: true, hiring_manager: false }],
    ["users:manage", { admin: true, recruiter: false, hiring_manager: false }],
    [
      "analytics:view",
      { admin: true, recruiter: true, hiring_manager: false },
    ],
  ] as const)("%s", (permission, expected) => {
    expect(can("admin", permission)).toBe(expected.admin);
    expect(can("recruiter", permission)).toBe(expected.recruiter);
    expect(can("hiring_manager", permission)).toBe(expected.hiring_manager);
  });
});
