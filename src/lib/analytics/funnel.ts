import { PIPELINE_STAGES, type Stage } from "@/lib/schemas";

// Funnel conversion by stage. "Reached stage S" = the application's current
// stage index is >= S. This works for rejected applications precisely
// because rejection PRESERVES the stage it happened from (milestone 5), so
// a rejected-from-interview candidate counts against interview's conversion
// instead of vanishing from the funnel.

export interface FunnelInput {
  stage: Stage;
  rejectedAt: Date | null;
}

export interface FunnelStage {
  stage: Stage;
  reached: number;
  rejectedHere: number;
  conversionToNext: number | null;
}

export function funnelCounts(apps: FunnelInput[]): FunnelStage[] {
  const reached = PIPELINE_STAGES.map(
    (_, stageIndex) =>
      apps.filter((app) => PIPELINE_STAGES.indexOf(app.stage) >= stageIndex)
        .length,
  );

  return PIPELINE_STAGES.map((stage, stageIndex) => ({
    stage,
    reached: reached[stageIndex] ?? 0,
    rejectedHere: apps.filter(
      (app) => app.stage === stage && app.rejectedAt !== null,
    ).length,
    conversionToNext:
      stageIndex < PIPELINE_STAGES.length - 1 && (reached[stageIndex] ?? 0) > 0
        ? (reached[stageIndex + 1] ?? 0) / (reached[stageIndex] ?? 1)
        : null,
  }));
}
