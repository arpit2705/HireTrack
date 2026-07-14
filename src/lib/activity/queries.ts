import { describeActivity } from "@/lib/activity/format";
import { db } from "@/lib/db";

// Per-entity audit timeline (plan.md section 3's
// activity_log(org_id, entity_type, entity_id) index is what serves this).
// A candidate's timeline merges the candidate's own rows with those of its
// applications and their interviews.

export interface TimelineEntry {
  id: string;
  action: string;
  description: string;
  actorName: string;
  isBulk: boolean;
  createdAt: Date;
}

export async function getCandidateTimeline(
  orgId: string,
  candidateId: string,
  limit = 50,
): Promise<TimelineEntry[]> {
  const applications = await db.application.findMany({
    where: { candidateId, job: { orgId } },
    select: { id: true },
  });
  const applicationIds = applications.map((app) => app.id);

  const interviews = applicationIds.length
    ? await db.interview.findMany({
        where: { applicationId: { in: applicationIds } },
        select: { id: true },
      })
    : [];

  const rows = await db.activityLog.findMany({
    where: {
      orgId,
      OR: [
        { entityType: "candidate", entityId: candidateId },
        ...(applicationIds.length
          ? [
              {
                entityType: "application",
                entityId: { in: applicationIds },
              },
            ]
          : []),
        ...(interviews.length
          ? [
              {
                entityType: "interview",
                entityId: { in: interviews.map((interview) => interview.id) },
              },
            ]
          : []),
      ],
    },
    include: { actor: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  // Resolve batch sizes so bulk entries can say "of N". Timelines have at
  // most a handful of distinct batches, so one count per batch is fine.
  const batchIds = [
    ...new Set(
      rows
        .map((row) => (row.metadata as { batchId?: string } | null)?.batchId)
        .filter((batchId): batchId is string => Boolean(batchId)),
    ),
  ];
  const batchSizes = new Map<string, number>();
  for (const batchId of batchIds) {
    batchSizes.set(
      batchId,
      await db.activityLog.count({
        where: {
          orgId,
          action: "bulk_rejected",
          metadata: { path: ["batchId"], equals: batchId },
        },
      }),
    );
  }

  return rows.map((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    const batchId =
      typeof metadata?.batchId === "string" ? metadata.batchId : undefined;
    return {
      id: row.id,
      action: row.action,
      description: describeActivity(row.action, metadata, {
        batchSize: batchId ? batchSizes.get(batchId) : undefined,
      }),
      actorName: row.actor.name,
      isBulk: row.action === "bulk_rejected",
      createdAt: row.createdAt,
    };
  });
}
