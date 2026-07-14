import { PIPELINE_STAGES, type ActivityAction, type Stage } from "@/lib/schemas";

// Pipeline movement rules (plan.md section 4 + confirmed decisions):
// - forward moves may jump stages (referrals can skip screening)
// - backward moves are allowed exactly one stage at a time
// - rejection is NOT a stage move (own endpoint, sets rejected_at + reason)
//
// The activity-action split is a hard analytics contract: milestone 8's
// time-to-hire excludes time attributed to reverted moves by filtering on
// stage_reverted, so the distinction must be correct at write time.

export type StageMove = "forward" | "backward" | "invalid";

export function classifyStageMove(from: Stage, to: Stage): StageMove {
  const delta = PIPELINE_STAGES.indexOf(to) - PIPELINE_STAGES.indexOf(from);
  if (delta >= 1) return "forward";
  if (delta === -1) return "backward";
  return "invalid";
}

export const ACTIVITY_FOR_MOVE: Record<
  Exclude<StageMove, "invalid">,
  ActivityAction
> = {
  forward: "stage_updated",
  backward: "stage_reverted",
};

// Single source for "where can this application go" - consulted by BOTH the
// board's drag validation and each card's "Move to" menu.
export function validTargetsFor(stage: Stage): Stage[] {
  return PIPELINE_STAGES.filter(
    (target) => classifyStageMove(stage, target) !== "invalid",
  );
}

// Re-application after soft delete revives the existing row (the
// (job_id, candidate_id) unique makes a second row impossible) and MUST
// clear rejection state along with the deletion marker (milestone-1 flag,
// enforced here).
export function revivalPatch(now: Date = new Date()): {
  deletedAt: null;
  rejectedAt: null;
  rejectedReason: null;
  stage: Stage;
  stageUpdatedAt: Date;
} {
  return {
    deletedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    stage: "applied",
    stageUpdatedAt: now,
  };
}
