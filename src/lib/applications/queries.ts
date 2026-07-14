import type { RequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import {
  ACTIVITY_FOR_MOVE,
  classifyStageMove,
  revivalPatch,
} from "@/lib/applications/stage-moves";
import type {
  ApplicationCreateInput,
  BulkRejectInput,
  ExportQuery,
  Stage,
} from "@/lib/schemas";
import { randomUUID } from "node:crypto";

// Applications carry no org_id; the org boundary is the job join -
// every WHERE goes through job: { orgId } so cross-org ids resolve to null.

const CANDIDATE_SELECT = {
  select: { id: true, name: true, email: true },
} as const;

const APPLICATION_INCLUDE = { candidate: CANDIDATE_SELECT } as const;

type ApplicationRecord = Awaited<
  ReturnType<typeof db.application.findFirstOrThrow>
> & { candidate: { id: string; name: string; email: string } };

export interface BoardApplication {
  id: string;
  jobId: string;
  stage: Stage;
  stageUpdatedAt: Date;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  createdAt: Date;
  candidate: { id: string; name: string; email: string };
}

function serialize(row: ApplicationRecord): BoardApplication {
  return {
    id: row.id,
    jobId: row.jobId,
    stage: row.stage,
    stageUpdatedAt: row.stageUpdatedAt,
    rejectedAt: row.rejectedAt,
    rejectedReason: row.rejectedReason,
    createdAt: row.createdAt,
    candidate: row.candidate,
  };
}

export interface JobBoard {
  active: BoardApplication[];
  rejected: BoardApplication[];
}

// Kanban board query (plan.md section 3): active side filters
// rejected_at IS NULL and is served by the (job_id, rejected_at) index
// from the rejection-model refactor.
export async function getJobBoard(
  orgId: string,
  jobId: string,
): Promise<JobBoard | null> {
  const job = await db.job.findFirst({ where: { id: jobId, orgId } });
  if (!job) return null;

  const [active, rejected] = await Promise.all([
    db.application.findMany({
      where: { jobId, deletedAt: null, rejectedAt: null },
      include: APPLICATION_INCLUDE,
      orderBy: [{ stageUpdatedAt: "asc" }, { id: "asc" }],
    }),
    db.application.findMany({
      where: { jobId, deletedAt: null, rejectedAt: { not: null } },
      include: APPLICATION_INCLUDE,
      orderBy: [{ rejectedAt: "desc" }, { id: "asc" }],
    }),
  ]);

  return { active: active.map(serialize), rejected: rejected.map(serialize) };
}

export class AlreadyApplied extends Error {}
export class InvalidStageMove extends Error {
  constructor(from: Stage, to: Stage) {
    super(`Cannot move from ${from} to ${to}`);
  }
}
export class ApplicationRejectedError extends Error {}

// Create-or-revive (plan.md section 10 dedupe): the (job_id, candidate_id)
// unique makes duplicates impossible; a soft-deleted row is revived with
// rejection state cleared (milestone-1 flag, revivalPatch).
export async function createApplication(
  user: RequestUser,
  input: ApplicationCreateInput,
): Promise<BoardApplication> {
  return db.$transaction(async (tx) => {
    const [job, candidate] = await Promise.all([
      tx.job.findFirst({ where: { id: input.jobId, orgId: user.orgId } }),
      tx.candidate.findFirst({
        where: { id: input.candidateId, orgId: user.orgId },
      }),
    ]);
    // Cross-org job or candidate ids do not resolve -> 404 at the route.
    if (!job || !candidate) return null as never;

    const existing = await tx.application.findUnique({
      where: {
        jobId_candidateId: { jobId: job.id, candidateId: candidate.id },
      },
    });

    if (existing && !existing.deletedAt) throw new AlreadyApplied();

    const row = existing
      ? await tx.application.update({
          where: { id: existing.id },
          data: revivalPatch(),
          include: APPLICATION_INCLUDE,
        })
      : await tx.application.create({
          data: { jobId: job.id, candidateId: candidate.id },
          include: APPLICATION_INCLUDE,
        });

    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "application",
        entityId: row.id,
        action: "created",
        metadata: {
          jobId: job.id,
          candidateId: candidate.id,
          revived: Boolean(existing),
        },
      },
    });
    return serialize(row);
  });
}

// Stage move with last-write-wins semantics (plan.md section 10): no
// version check on purpose - concurrent movers both succeed and BOTH land
// in the activity log; the final row state is the later write.
export async function moveApplicationStage(
  user: RequestUser,
  id: string,
  to: Stage,
): Promise<BoardApplication | null> {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, deletedAt: null, job: { orgId: user.orgId } },
    });
    if (!app) return null;
    if (app.rejectedAt) throw new ApplicationRejectedError();

    const move = classifyStageMove(app.stage, to);
    if (move === "invalid") throw new InvalidStageMove(app.stage, to);

    const updated = await tx.application.update({
      where: { id: app.id },
      data: { stage: to, stageUpdatedAt: new Date() },
      include: APPLICATION_INCLUDE,
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "application",
        entityId: app.id,
        action: ACTIVITY_FOR_MOVE[move],
        metadata: { from: app.stage, to },
      },
    });
    return serialize(updated);
  });
}

export async function rejectApplication(
  user: RequestUser,
  id: string,
  reason: string,
): Promise<BoardApplication | null> {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, deletedAt: null, job: { orgId: user.orgId } },
    });
    if (!app) return null;
    if (app.rejectedAt) throw new ApplicationRejectedError();

    const updated = await tx.application.update({
      where: { id: app.id },
      // Stage is preserved: rejection is orthogonal, and the stage rejected
      // from feeds milestone-8 funnel analytics.
      data: { rejectedAt: new Date(), rejectedReason: reason },
      include: APPLICATION_INCLUDE,
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "application",
        entityId: app.id,
        action: "rejected",
        metadata: { stage: app.stage, reason },
      },
    });
    return serialize(updated);
  });
}

export class ApplicationNotRejected extends Error {}

// Undo a rejection: clears rejected_at/rejected_reason; the application
// reappears on the board at the stage it was rejected from (stage was never
// changed by rejection). Logged as a DISTINCT unrejected action.
export async function unrejectApplication(
  user: RequestUser,
  id: string,
): Promise<BoardApplication | null> {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, deletedAt: null, job: { orgId: user.orgId } },
    });
    if (!app) return null;
    if (!app.rejectedAt) throw new ApplicationNotRejected();

    const updated = await tx.application.update({
      where: { id: app.id },
      data: { rejectedAt: null, rejectedReason: null },
      include: APPLICATION_INCLUDE,
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "application",
        entityId: app.id,
        action: "unrejected",
        metadata: { stage: app.stage, previousReason: app.rejectedReason },
      },
    });
    return serialize(updated);
  });
}

// Bulk reject. Targets resolve server-side and org-scoped either from
// explicit ids (checkbox selection) or from a filter - the filter path IS
// select-all-across-pages: it hits the whole filtered set regardless of
// what the client had rendered. One activity row PER application (milestone
// 9 needs per-entity queryability), tied together by a batch id.
export async function bulkRejectApplications(
  user: RequestUser,
  input: BulkRejectInput,
): Promise<{ rejected: number } | null> {
  return db.$transaction(async (tx) => {
    let targets: { id: string; stage: Stage }[];

    if (input.filter) {
      const job = await tx.job.findFirst({
        where: { id: input.filter.jobId, orgId: user.orgId },
      });
      if (!job) return null; // cross-org/missing job -> 404
      targets = await tx.application.findMany({
        where: {
          jobId: job.id,
          deletedAt: null,
          rejectedAt: null,
          ...(input.filter.stage ? { stage: input.filter.stage } : {}),
        },
        select: { id: true, stage: true },
      });
    } else {
      // Cross-org or already-rejected ids simply don't match the WHERE.
      targets = await tx.application.findMany({
        where: {
          id: { in: input.applicationIds ?? [] },
          deletedAt: null,
          rejectedAt: null,
          job: { orgId: user.orgId },
        },
        select: { id: true, stage: true },
      });
    }

    if (targets.length === 0) return { rejected: 0 };

    const now = new Date();
    const batchId = randomUUID();
    await tx.application.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { rejectedAt: now, rejectedReason: input.reason },
    });
    await tx.activityLog.createMany({
      data: targets.map((target) => ({
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "application",
        entityId: target.id,
        action: "bulk_rejected",
        metadata: { reason: input.reason, stage: target.stage, batchId },
      })),
    });
    return { rejected: targets.length };
  });
}

const EXPORT_BATCH_SIZE = 500;

export interface ExportRow {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  stage: Stage;
  stageUpdatedAt: Date;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  createdAt: Date;
}

// Cursor-batched iterator for the streamed CSV export: at most
// EXPORT_BATCH_SIZE rows are ever in memory, however large the pipeline.
export async function* iterateExportRows(
  orgId: string,
  query: ExportQuery,
): AsyncGenerator<ExportRow[]> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.application.findMany({
      where: {
        deletedAt: null,
        job: { orgId, ...(query.jobId ? { id: query.jobId } : {}) },
        ...(query.stage ? { stage: query.stage } : {}),
      },
      include: {
        candidate: { select: { name: true, email: true } },
        job: { select: { title: true } },
      },
      orderBy: { id: "asc" },
      take: EXPORT_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) return;

    yield batch.map((row) => ({
      candidateName: row.candidate.name,
      candidateEmail: row.candidate.email,
      jobTitle: row.job.title,
      stage: row.stage,
      stageUpdatedAt: row.stageUpdatedAt,
      rejectedAt: row.rejectedAt,
      rejectedReason: row.rejectedReason,
      createdAt: row.createdAt,
    }));

    if (batch.length < EXPORT_BATCH_SIZE) return;
    cursor = batch[batch.length - 1]?.id;
  }
}

export async function softDeleteApplication(
  user: RequestUser,
  id: string,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, deletedAt: null, job: { orgId: user.orgId } },
    });
    if (!app) return false;

    await tx.application.update({
      where: { id: app.id },
      data: { deletedAt: new Date() },
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "application",
        entityId: app.id,
        action: "deleted",
        metadata: { stage: app.stage },
      },
    });
    return true;
  });
}
