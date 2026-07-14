import type { RequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import type {
  InterviewCreateInput,
  InterviewStatus,
  InterviewType,
  Recommendation,
  ScorecardCreateInput,
  Stage,
} from "@/lib/schemas";

// Interviews hang off application -> job -> org (same boundary chain as
// applications). Hiring-manager row-level access is defined ENTIRELY by
// interview.interviewer_id - never by job or org membership alone.

const INTERVIEW_INCLUDE = {
  application: {
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      job: { select: { id: true, title: true } },
    },
  },
  interviewer: { select: { id: true, name: true } },
  scorecard: true,
} as const;

type InterviewRecord = Awaited<
  ReturnType<typeof db.interview.findFirstOrThrow>
> & {
  application: {
    id: string;
    stage: Stage;
    candidate: { id: string; name: string; email: string };
    job: { id: string; title: string };
  };
  interviewer: { id: string; name: string };
  scorecard: {
    id: string;
    rating: number;
    recommendation: Recommendation;
    notes: string;
    createdAt: Date;
  } | null;
};

export interface InterviewWire {
  id: string;
  scheduledAt: Date;
  type: InterviewType;
  status: InterviewStatus;
  interviewer: { id: string; name: string };
  application: { id: string; jobId: string; jobTitle: string };
  candidate: { id: string; name: string; email: string };
  scorecard: {
    rating: number;
    recommendation: Recommendation;
    notes: string;
    createdAt: Date;
  } | null;
}

function serialize(row: InterviewRecord): InterviewWire {
  return {
    id: row.id,
    scheduledAt: row.scheduledAt,
    type: row.type,
    status: row.status,
    interviewer: row.interviewer,
    application: {
      id: row.application.id,
      jobId: row.application.job.id,
      jobTitle: row.application.job.title,
    },
    candidate: row.application.candidate,
    scorecard: row.scorecard
      ? {
          rating: row.scorecard.rating,
          recommendation: row.scorecard.recommendation,
          notes: row.scorecard.notes,
          createdAt: row.scorecard.createdAt,
        }
      : null,
  };
}

// HM: only interviews where THEY are the interviewer. Recruiter/admin: org-wide.
export async function listInterviews(user: RequestUser): Promise<InterviewWire[]> {
  const rows = await db.interview.findMany({
    where:
      user.role === "hiring_manager"
        ? { interviewerId: user.userId }
        : { application: { job: { orgId: user.orgId } } },
    include: INTERVIEW_INCLUDE,
    orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return (rows as InterviewRecord[]).map(serialize);
}

export function getInterview(
  orgId: string,
  id: string,
): Promise<InterviewRecord | null> {
  return db.interview.findFirst({
    where: { id, application: { job: { orgId } } },
    include: INTERVIEW_INCLUDE,
  }) as Promise<InterviewRecord | null>;
}

export class InvalidInterviewer extends Error {}
export class ApplicationNotSchedulable extends Error {}

export async function scheduleInterview(
  user: RequestUser,
  input: InterviewCreateInput,
): Promise<InterviewWire | null> {
  return db.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: {
        id: input.applicationId,
        deletedAt: null,
        job: { orgId: user.orgId },
      },
    });
    if (!application) return null; // cross-org/missing -> 404
    if (application.rejectedAt) throw new ApplicationNotSchedulable();

    // Interviewer must be an ACTIVE hiring manager in the SAME org - a
    // cross-org interviewer id is indistinguishable from an invalid one.
    const interviewer = await tx.user.findFirst({
      where: {
        id: input.interviewerId,
        orgId: user.orgId,
        role: "hiring_manager",
        deactivatedAt: null,
      },
    });
    if (!interviewer) throw new InvalidInterviewer();

    const interview = await tx.interview.create({
      data: {
        applicationId: application.id,
        interviewerId: interviewer.id,
        scheduledAt: input.scheduledAt,
        type: input.type,
      },
      include: INTERVIEW_INCLUDE,
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "interview",
        entityId: interview.id,
        action: "interview_scheduled",
        metadata: {
          applicationId: application.id,
          interviewerId: interviewer.id,
          type: input.type,
          scheduledAt: input.scheduledAt.toISOString(),
        },
      },
    });
    return serialize(interview as InterviewRecord);
  });
}

export class InterviewNotCancellable extends Error {}

export async function cancelInterview(
  user: RequestUser,
  id: string,
): Promise<InterviewWire | null> {
  return db.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id, application: { job: { orgId: user.orgId } } },
    });
    if (!interview) return null;
    if (interview.status !== "scheduled") throw new InterviewNotCancellable();

    const updated = await tx.interview.update({
      where: { id: interview.id },
      data: { status: "cancelled" },
      include: INTERVIEW_INCLUDE,
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "interview",
        entityId: interview.id,
        action: "interview_cancelled",
        metadata: { applicationId: interview.applicationId },
      },
    });
    return serialize(updated as InterviewRecord);
  });
}

export class NotYourInterview extends Error {}
export class ScorecardExists extends Error {}
export class InterviewCancelledError extends Error {}

// Scorecard submission: the assigned interviewer ONLY. The proxy already
// restricts this route to hiring managers (admins/recruiters get 403 there -
// the matrix's deliberate negative); this row check narrows it to the one
// assigned HM.
export async function submitScorecard(
  user: RequestUser,
  interviewId: string,
  input: ScorecardCreateInput,
): Promise<InterviewWire | null> {
  return db.$transaction(async (tx) => {
    const interview = await tx.interview.findFirst({
      where: { id: interviewId, application: { job: { orgId: user.orgId } } },
      include: { scorecard: true },
    });
    if (!interview) return null; // cross-org -> 404
    if (interview.interviewerId !== user.userId) throw new NotYourInterview();
    if (interview.status === "cancelled") throw new InterviewCancelledError();
    if (interview.scorecard) throw new ScorecardExists();

    await tx.scorecard.create({
      data: {
        interviewId: interview.id,
        submittedById: user.userId,
        rating: input.rating,
        recommendation: input.recommendation,
        notes: input.notes,
      },
    });
    const updated = await tx.interview.update({
      where: { id: interview.id },
      data: { status: "completed" },
      include: INTERVIEW_INCLUDE,
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "interview",
        entityId: interview.id,
        action: "scorecard_submitted",
        metadata: {
          applicationId: interview.applicationId,
          rating: input.rating,
          recommendation: input.recommendation,
        },
      },
    });
    return serialize(updated as InterviewRecord);
  });
}

// The HM row-level gate for candidate reads: assignment = any interview on
// any of the candidate's applications with this user as interviewer.
export async function hasAssignedInterview(
  userId: string,
  candidateId: string,
): Promise<boolean> {
  const found = await db.interview.findFirst({
    where: { interviewerId: userId, application: { candidateId } },
    select: { id: true },
  });
  return found !== null;
}
