import { z } from "zod";

// Shared Zod schemas for the HireTrack domain model (plan.md section 3).
// These are the wire-format entity schemas, shared client/server. Enum
// literals mirror prisma/schema.prisma exactly (lowercase in both).
// Create/update input schemas are added with their vertical slices.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleSchema = z.enum(["admin", "recruiter", "hiring_manager"]);
export type Role = z.infer<typeof roleSchema>;

export const jobStatusSchema = z.enum(["draft", "open", "closed"]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

// Linear pipeline order (plan.md section 4). Rejection is not a stage: an
// application is rejected when application.rejectedAt is set, preserving the
// stage it was rejected from. Backward stage moves are allowed one stage at a
// time and logged as stage_reverted, not stage_updated.
export const PIPELINE_STAGES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
] as const;

export const stageSchema = z.enum(PIPELINE_STAGES);
export type Stage = z.infer<typeof stageSchema>;

export const interviewTypeSchema = z.enum(["phone", "technical", "onsite"]);
export type InterviewType = z.infer<typeof interviewTypeSchema>;

export const interviewStatusSchema = z.enum([
  "scheduled",
  "completed",
  "cancelled",
]);
export type InterviewStatus = z.infer<typeof interviewStatusSchema>;

export const recommendationSchema = z.enum([
  "strong_yes",
  "yes",
  "no",
  "strong_no",
]);
export type Recommendation = z.infer<typeof recommendationSchema>;

// ActivityLog.action is a plain string column in the DB (the set grows with
// features); this enum is the app-level source of truth for allowed values.
export const activityActionSchema = z.enum([
  "created",
  "updated",
  "deleted",
  "stage_updated",
  "stage_reverted",
  "rejected",
  "unrejected",
  "bulk_rejected",
  "csv_exported",
  "interview_scheduled",
  "interview_completed",
  "interview_cancelled",
  "scorecard_submitted",
  "user_invited",
  "user_role_changed",
  "user_deactivated",
]);
export type ActivityAction = z.infer<typeof activityActionSchema>;

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

const id = z.string().min(1);
// Timestamps arrive as Date on the server and ISO strings over JSON.
const timestamp = z.coerce.date();

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export const organizationSchema = z.object({
  id,
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits, hyphens"),
  createdAt: timestamp,
});
export type Organization = z.infer<typeof organizationSchema>;

// passwordHash is deliberately absent: it must never cross the API boundary.
export const userSchema = z.object({
  id,
  orgId: id,
  email: z.email(),
  name: z.string().min(1),
  role: roleSchema,
  emailVerifiedAt: timestamp.nullable(),
  deactivatedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type User = z.infer<typeof userSchema>;

export const jobSchema = z.object({
  id,
  orgId: id,
  title: z.string().min(1),
  department: z.string().min(1),
  location: z.string().min(1),
  status: jobStatusSchema,
  createdById: id,
  createdAt: timestamp,
  updatedAt: timestamp,
  closedAt: timestamp.nullable(),
});
export type Job = z.infer<typeof jobSchema>;

// email is required (not nullable): it is the org-level dedupe key.
export const candidateSchema = z.object({
  id,
  orgId: id,
  name: z.string().min(1),
  email: z.email(),
  phone: z.string().nullable(),
  // App-relative download path (/api/candidates/:id/resume). The underlying
  // storage locator is server-side only and never crosses the API boundary.
  resumeUrl: z.string().startsWith("/").nullable(),
  source: z.string().nullable(),
  tags: z.array(z.string().min(1)).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Candidate = z.infer<typeof candidateSchema>;

export const applicationSchema = z
  .object({
    id,
    jobId: id,
    candidateId: id,
    stage: stageSchema,
    stageUpdatedAt: timestamp,
    rejectedAt: timestamp.nullable(),
    rejectedReason: z.string().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: timestamp.nullable(),
  })
  .superRefine((app, ctx) => {
    // Mirrors the DB CHECK: (rejected_at IS NULL) = (rejected_reason IS NULL).
    if (app.rejectedAt !== null && !app.rejectedReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectedReason"],
        message: "A rejection reason is required when an application is rejected",
      });
    }
    if (app.rejectedAt === null && app.rejectedReason !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectedReason"],
        message: "A rejection reason is only allowed on a rejected application",
      });
    }
  });
export type Application = z.infer<typeof applicationSchema>;

export const interviewSchema = z.object({
  id,
  applicationId: id,
  scheduledAt: timestamp,
  interviewerId: id,
  type: interviewTypeSchema,
  status: interviewStatusSchema,
  createdAt: timestamp,
});
export type Interview = z.infer<typeof interviewSchema>;

export const scorecardSchema = z.object({
  id,
  interviewId: id,
  submittedById: id,
  // Mirrors the DB CHECK constraint scorecard_rating_range.
  rating: z.number().int().min(1).max(5),
  recommendation: recommendationSchema,
  notes: z.string().min(1),
  createdAt: timestamp,
});
export type Scorecard = z.infer<typeof scorecardSchema>;

// ---------------------------------------------------------------------------
// Job input schemas (milestone 3) - shared by API routes and forms
// ---------------------------------------------------------------------------
// strictObject: unknown keys are rejected, not silently stripped. A payload
// smuggling orgId/createdById is a 400, never an accepted-and-ignored field -
// org scoping comes exclusively from the server-side session.

export const jobCreateSchema = z.strictObject({
  title: z.string().trim().min(2, "Title needs at least 2 characters").max(120),
  department: z.string().trim().min(1, "Department is required").max(80),
  location: z.string().trim().min(1, "Location is required").max(120),
  // A job may be created as draft or published immediately - never born closed.
  status: z.enum(["draft", "open"]).default("draft"),
});
export type JobCreateInput = z.infer<typeof jobCreateSchema>;

export const jobUpdateSchema = z
  .strictObject({
    title: z.string().trim().min(2).max(120).optional(),
    department: z.string().trim().min(1).max(80).optional(),
    location: z.string().trim().min(1).max(120).optional(),
    status: jobStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Update at least one field",
  });
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;

export const JOB_SORTS = [
  "created_desc",
  "created_asc",
  "title_asc",
  "title_desc",
] as const;
export type JobSort = (typeof JOB_SORTS)[number];

export const jobListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: jobStatusSchema.optional(),
  sort: z.enum(JOB_SORTS).default("created_desc"),
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .transform((n) => Math.min(n, 50))
    .default(20),
});
export type JobListQuery = z.infer<typeof jobListQuerySchema>;

// URL-driven filters: empty strings (cleared form fields) read as absent.
export function parseJobListQuery(params: URLSearchParams): JobListQuery {
  const raw: Record<string, string> = {};
  for (const key of ["q", "status", "sort", "cursor", "limit"] as const) {
    const value = params.get(key);
    if (value) raw[key] = value;
  }
  return jobListQuerySchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Application input schemas (milestone 5) - shared by API routes and forms
// ---------------------------------------------------------------------------

export const applicationCreateSchema = z.strictObject({
  jobId: z.string().min(1),
  candidateId: z.string().min(1),
});
export type ApplicationCreateInput = z.infer<typeof applicationCreateSchema>;

export const stageMoveSchema = z.strictObject({
  stage: stageSchema,
});
export type StageMoveInput = z.infer<typeof stageMoveSchema>;

export const rejectApplicationSchema = z.strictObject({
  reason: z.string().trim().min(2, "A rejection reason is required").max(500),
});
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;

// Bulk reject (milestone 7). Target is EITHER an explicit id list (checkbox
// selection) or a filter (select-all-across-pages: the whole filtered set
// server-side, independent of what the client had rendered).
export const bulkRejectSchema = z
  .strictObject({
    reason: z
      .string()
      .trim()
      .min(2, "A rejection reason is required")
      .max(500),
    applicationIds: z.array(z.string().min(1)).min(1).max(500).optional(),
    filter: z
      .strictObject({
        jobId: z.string().min(1),
        stage: stageSchema.optional(),
      })
      .optional(),
  })
  .refine(
    (value) => Boolean(value.applicationIds) !== Boolean(value.filter),
    { message: "Provide exactly one target: applicationIds or filter" },
  );
export type BulkRejectInput = z.infer<typeof bulkRejectSchema>;

export const exportQuerySchema = z.object({
  jobId: z.string().min(1).optional(),
  stage: stageSchema.optional(),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

// ---------------------------------------------------------------------------
// Interview & scorecard input schemas (milestone 6)
// ---------------------------------------------------------------------------

export const interviewCreateSchema = z.strictObject({
  applicationId: z.string().min(1),
  // Required, never null: a scheduled interview with no interviewer is a bug
  // (plan.md section 3 flag). The DB column is NOT NULL to match.
  interviewerId: z.string().min(1, "An interviewer is required"),
  scheduledAt: z.coerce.date(),
  type: interviewTypeSchema,
});
export type InterviewCreateInput = z.infer<typeof interviewCreateSchema>;

// submittedById comes from the session, interviewId from the URL - neither
// is accepted in the body (strictObject rejects them outright).
export const scorecardCreateSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  recommendation: recommendationSchema,
  notes: z.string().trim().min(1, "Notes are required").max(4000),
});
export type ScorecardCreateInput = z.infer<typeof scorecardCreateSchema>;

// ---------------------------------------------------------------------------
// Candidate input schemas (milestone 4) - shared by API routes and forms
// ---------------------------------------------------------------------------
// strictObject again: orgId cannot be smuggled, and resumeUrl is not writable
// through candidate endpoints at all - the resume changes only through the
// dedicated upload endpoint, which stores a server-side locator.

const tagSchema = z.string().trim().min(1).max(30);

export const candidateCreateSchema = z.strictObject({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email address"),
  phone: z.string().trim().min(3).max(40).nullish(),
  source: z.string().trim().min(1).max(80).nullish(),
  tags: z.array(tagSchema).max(10).default([]),
});
export type CandidateCreateInput = z.infer<typeof candidateCreateSchema>;

export const candidateUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.email().optional(),
    phone: z.string().trim().min(3).max(40).nullish(),
    source: z.string().trim().min(1).max(80).nullish(),
    tags: z.array(tagSchema).max(10).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Update at least one field",
  });
export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;

export const candidateListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  tag: tagSchema.optional(),
  sort: z.enum(["created_desc", "created_asc", "name_asc"]).default(
    "created_desc",
  ),
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .transform((n) => Math.min(n, 50))
    .default(20),
});
export type CandidateListQuery = z.infer<typeof candidateListQuerySchema>;

export function parseCandidateListQuery(
  params: URLSearchParams,
): CandidateListQuery {
  const raw: Record<string, string> = {};
  for (const key of ["q", "tag", "sort", "cursor", "limit"] as const) {
    const value = params.get(key);
    if (value) raw[key] = value;
  }
  return candidateListQuerySchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Settings input schemas (milestone 9) - admin user management + org
// ---------------------------------------------------------------------------

export const userInviteSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  email: z.email("Enter a valid email address"),
  role: roleSchema,
});
export type UserInviteInput = z.infer<typeof userInviteSchema>;

export const userRoleSchema = z.strictObject({
  role: roleSchema,
});
export type UserRoleInput = z.infer<typeof userRoleSchema>;

export const orgUpdateSchema = z.strictObject({
  name: z.string().trim().min(2, "Name needs at least 2 characters").max(80),
});
export type OrgUpdateInput = z.infer<typeof orgUpdateSchema>;

// ---------------------------------------------------------------------------
// Auth input schemas (milestone 2) - shared by API routes and forms
// ---------------------------------------------------------------------------

export const signupInputSchema = z.object({
  orgName: z.string().trim().min(2, "Organization name needs at least 2 characters").max(80),
  name: z.string().trim().min(1, "Your name is required").max(80),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password needs at least 8 characters").max(128),
});
export type SignupInput = z.infer<typeof signupInputSchema>;

export const loginInputSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const resetRequestSchema = z.object({
  email: z.email(),
});
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

export const resetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password needs at least 8 characters").max(128),
});
export type ResetConfirmInput = z.infer<typeof resetConfirmSchema>;

export const activityLogSchema = z.object({
  id,
  orgId: id,
  actorId: id,
  entityType: z.string().min(1),
  entityId: id,
  action: activityActionSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: timestamp,
});
export type ActivityLog = z.infer<typeof activityLogSchema>;
