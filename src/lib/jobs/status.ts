import type { JobStatus } from "@/lib/schemas";

// Job requisition lifecycle: draft -> open -> closed, with reopen allowed.
// A job can never return to draft once published, and a no-op "change" is
// rejected so handlers don't write spurious activity-log rows.
const ALLOWED: Record<JobStatus, readonly JobStatus[]> = {
  draft: ["open", "closed"],
  open: ["closed"],
  closed: ["open"],
};

export function canChangeJobStatus(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function applyJobStatusChange(
  to: JobStatus,
  now: Date = new Date(),
): { status: JobStatus; closedAt: Date | null } {
  return { status: to, closedAt: to === "closed" ? now : null };
}
