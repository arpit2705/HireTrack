import type { RequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import {
  type Job,
  type JobCreateInput,
  type JobListQuery,
  type JobSort,
  type JobUpdateInput,
} from "@/lib/schemas";
import { applyJobStatusChange, canChangeJobStatus } from "@/lib/jobs/status";

// All queries take orgId (or a RequestUser) as their first argument and bake
// it into the WHERE clause - callers cannot forget the org boundary, and a
// cross-org id simply does not resolve (null -> 404, no existence leak).

type JobRecord = Awaited<ReturnType<typeof db.job.findFirstOrThrow>>;

const SORT_ORDER: Record<
  JobSort,
  Array<Record<string, "asc" | "desc">>
> = {
  created_desc: [{ createdAt: "desc" }, { id: "desc" }],
  created_asc: [{ createdAt: "asc" }, { id: "asc" }],
  title_asc: [{ title: "asc" }, { id: "asc" }],
  title_desc: [{ title: "desc" }, { id: "desc" }],
};

export interface JobListResult {
  items: JobRecord[];
  nextCursor: string | null;
}

export async function listJobs(
  orgId: string,
  query: JobListQuery,
): Promise<JobListResult> {
  const rows = await db.job.findMany({
    where: {
      orgId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              {
                department: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
              {
                location: { contains: query.q, mode: "insensitive" as const },
              },
            ],
          }
        : {}),
    },
    orderBy: SORT_ORDER[query.sort],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export function getJob(orgId: string, id: string): Promise<JobRecord | null> {
  return db.job.findFirst({ where: { id, orgId } });
}

export async function createJob(
  user: RequestUser,
  input: JobCreateInput,
): Promise<JobRecord> {
  return db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        orgId: user.orgId,
        createdById: user.userId,
        title: input.title,
        department: input.department,
        location: input.location,
        status: input.status,
      },
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "job",
        entityId: job.id,
        action: "created",
        metadata: { title: job.title, status: job.status },
      },
    });
    return job;
  });
}

export class InvalidJobStatusChange extends Error {
  constructor(from: Job["status"], to: Job["status"]) {
    super(`Cannot change job status from ${from} to ${to}`);
  }
}

export async function updateJob(
  user: RequestUser,
  id: string,
  input: JobUpdateInput,
): Promise<JobRecord | null> {
  return db.$transaction(async (tx) => {
    const job = await tx.job.findFirst({ where: { id, orgId: user.orgId } });
    if (!job) return null;

    const { status, ...fields } = input;
    let statusPatch = {};
    if (status && status !== job.status) {
      if (!canChangeJobStatus(job.status, status)) {
        throw new InvalidJobStatusChange(job.status, status);
      }
      statusPatch = applyJobStatusChange(status);
    }

    const updated = await tx.job.update({
      where: { id: job.id },
      data: { ...fields, ...statusPatch },
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "job",
        entityId: job.id,
        action: "updated",
        metadata: {
          changed: Object.keys(input),
          ...(status && status !== job.status
            ? { statusFrom: job.status, statusTo: status }
            : {}),
        },
      },
    });
    return updated;
  });
}
