import { PIPELINE_STAGES, type Stage } from "@/lib/schemas";

// Time-to-hire excluding reverted time - implements, EXACTLY, the
// "Time-to-hire methodology" note in docs/architecture.md. The unit tests
// reproduce the doc's worked examples; if doc and code disagree, the doc
// wins and the code is wrong.
//
// Underwater rule: exclude every interval during which the application's
// current stage sits BELOW the highest stage already reached.

export interface StageEvent {
  action: "stage_updated" | "stage_reverted";
  to: Stage;
  at: Date;
}

const index = (stage: Stage) => PIPELINE_STAGES.indexOf(stage);

export function underwaterMs(createdAt: Date, events: StageEvent[]): number {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());

  let underwater = 0;
  let previousTime = createdAt.getTime();
  let current = 0; // applied
  let maxReached = 0;

  for (const event of sorted) {
    if (current < maxReached) {
      underwater += event.at.getTime() - previousTime;
    }
    current = index(event.to);
    maxReached = Math.max(maxReached, current);
    previousTime = event.at.getTime();
  }
  return underwater;
}

// Null when the trail never reaches hired. The hire moment is the
// stage_updated -> hired event's timestamp.
export function timeToHireMs(
  createdAt: Date,
  events: StageEvent[],
): number | null {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const hire = sorted.find((event) => event.to === "hired");
  if (!hire) return null;

  const upToHire = sorted.filter(
    (event) => event.at.getTime() <= hire.at.getTime(),
  );
  return (
    hire.at.getTime() - createdAt.getTime() - underwaterMs(createdAt, upToHire)
  );
}
