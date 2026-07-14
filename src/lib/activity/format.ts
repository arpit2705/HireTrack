import type { ActivityAction } from "@/lib/schemas";

// Human-readable one-liners for activity trail entries. Bulk rejections are
// deliberately NEVER rendered like one-off rejections: the batch context is
// part of the audit record (milestone-7 requirement).

type Metadata = Record<string, unknown> | null | undefined;

const str = (metadata: Metadata, key: string): string | null => {
  const value = metadata?.[key];
  return typeof value === "string" && value ? value : null;
};
const num = (metadata: Metadata, key: string): number | null => {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
};

export function describeActivity(
  action: ActivityAction | string,
  metadata: Metadata,
  context: { batchSize?: number } = {},
): string {
  switch (action) {
    case "created":
      return metadata && (metadata as { revived?: boolean }).revived
        ? "Re-applied (previous application revived)"
        : "Created";
    case "updated": {
      const changed = metadata?.changed;
      return Array.isArray(changed) && changed.length > 0
        ? `Updated ${changed.join(", ")}`
        : "Updated";
    }
    case "deleted":
      return "Removed from pipeline";
    case "stage_updated":
      return `Moved from ${str(metadata, "from")} to ${str(metadata, "to")}`;
    case "stage_reverted":
      return `Moved back from ${str(metadata, "from")} to ${str(metadata, "to")}`;
    case "rejected":
      return `Rejected — ${str(metadata, "reason") ?? "no reason recorded"}`;
    case "bulk_rejected": {
      const suffix = str(metadata, "reason") ?? "no reason recorded";
      return context.batchSize
        ? `Rejected as part of a bulk action of ${context.batchSize} — ${suffix}`
        : `Rejected as part of a bulk action — ${suffix}`;
    }
    case "unrejected":
      return `Reinstated to ${str(metadata, "stage")}`;
    case "interview_scheduled":
      return `Interview scheduled (${str(metadata, "type")})`;
    case "interview_completed":
      return "Interview completed";
    case "interview_cancelled":
      return "Interview cancelled";
    case "scorecard_submitted":
      return `Scorecard submitted (${num(metadata, "rating")}/5)`;
    case "csv_exported":
      return "Pipeline exported to CSV";
    case "user_invited":
      return `Invited as ${str(metadata, "role")}`;
    case "user_role_changed":
      return `Role changed from ${str(metadata, "from")} to ${str(metadata, "to")}`;
    case "user_deactivated":
      return "Deactivated";
    default:
      return String(action).replaceAll("_", " ");
  }
}
