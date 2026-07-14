import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import type { InterviewType, Recommendation, Role, Stage } from "../src/lib/schemas";

// Demo seed (milestone 13). Idempotent by reconstruction: the demo org is
// deleted wholesale (FK-safe order) and rebuilt, so re-running never
// duplicates or accumulates. Every product state is represented: candidates
// across all stages, a reverted stage, a rejected-then-unrejected candidate,
// individual AND bulk rejections, completed/scheduled/cancelled interviews,
// scorecards, and hires with VARIED time-to-hire (one including reverted
// time, so the analytics dashboard shows naive != excluding-reverted).

const ORG_SLUG = "demo-talent-co";
const DEMO_PASSWORD = "demo1234";

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);
const daysAhead = (n: number) => new Date(now + n * 24 * 60 * 60 * 1000);

async function main() {
  console.log("Seeding demo org…");

  // ---- Teardown (idempotency) ----
  const existing = await db.organization.findUnique({
    where: { slug: ORG_SLUG },
  });
  if (existing) {
    const jobIds = (
      await db.job.findMany({ where: { orgId: existing.id }, select: { id: true } })
    ).map((j) => j.id);
    await db.scorecard.deleteMany({
      where: { interview: { application: { jobId: { in: jobIds } } } },
    });
    await db.interview.deleteMany({
      where: { application: { jobId: { in: jobIds } } },
    });
    await db.application.deleteMany({ where: { jobId: { in: jobIds } } });
    await db.organization.delete({ where: { id: existing.id } }); // cascades users/jobs/candidates/logs
    console.log("  removed previous demo org");
  }
  await db.rateLimit.deleteMany({
    where: { key: { contains: "@demo.com" } },
  });

  // ---- Org + users ----
  const passwordHash = await hash(DEMO_PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const org = await db.organization.create({
    data: {
      name: "Demo Talent Co",
      slug: ORG_SLUG,
      createdAt: daysAgo(60),
    },
  });

  async function user(name: string, email: string, role: Role, createdDaysAgo: number) {
    return db.user.create({
      data: {
        orgId: org.id,
        name,
        email,
        role,
        passwordHash,
        emailVerifiedAt: daysAgo(createdDaysAgo),
        createdAt: daysAgo(createdDaysAgo),
      },
    });
  }
  const demo = await user("Demo Admin", "demo@demo.com", "admin", 60);
  const rachel = await user("Rachel Alvarez", "rachel@demo.com", "recruiter", 58);
  const marcus = await user("Marcus Chen", "marcus@demo.com", "hiring_manager", 55);
  const priya = await user("Priya Raman", "priya@demo.com", "hiring_manager", 55);

  // ---- Jobs ----
  const backend = await db.job.create({
    data: {
      orgId: org.id, createdById: rachel.id, title: "Senior Backend Engineer",
      department: "Engineering", location: "Remote (EU)", status: "open",
      createdAt: daysAgo(45), updatedAt: daysAgo(45),
    },
  });
  const designer = await db.job.create({
    data: {
      orgId: org.id, createdById: rachel.id, title: "Product Designer",
      department: "Design", location: "Berlin / hybrid", status: "open",
      createdAt: daysAgo(30), updatedAt: daysAgo(30),
    },
  });
  await db.job.create({
    data: {
      orgId: org.id, createdById: demo.id, title: "Engineering Manager",
      department: "Engineering", location: "Remote (EU)", status: "draft",
      createdAt: daysAgo(3), updatedAt: daysAgo(3),
    },
  });
  const analyst = await db.job.create({
    data: {
      orgId: org.id, createdById: rachel.id, title: "Data Analyst",
      department: "Operations", location: "Amsterdam", status: "closed",
      createdAt: daysAgo(70), updatedAt: daysAgo(10), closedAt: daysAgo(10),
    },
  });

  // ---- Helpers ----
  async function log(
    actorId: string, entityType: string, entityId: string,
    action: string, metadata: object, at: Date,
  ) {
    await db.activityLog.create({
      data: { orgId: org.id, actorId, entityType, entityId, action, metadata, createdAt: at },
    });
  }

  interface StageStep { to: Stage; at: Date; reverted?: boolean }

  async function candidate(
    name: string, email: string, source: string, tags: string[], at: Date,
  ) {
    return db.candidate.create({
      data: { orgId: org.id, name, email, source, tags, createdAt: at, updatedAt: at },
    });
  }

  // Creates the application + a believable backdated activity trail.
  async function application(opts: {
    jobId: string; candidateName: string; email: string; source: string;
    tags: string[]; appliedAt: Date; steps: StageStep[];
    rejected?: { at: Date; reason: string; batchId?: string };
    unrejectedAt?: Date;
  }) {
    const cand = await candidate(opts.candidateName, opts.email, opts.source, opts.tags, opts.appliedAt);
    const lastStep = opts.steps[opts.steps.length - 1];
    const stage: Stage = lastStep ? lastStep.to : "applied";
    const stageUpdatedAt = lastStep ? lastStep.at : opts.appliedAt;
    const isRejected = Boolean(opts.rejected) && !opts.unrejectedAt;

    const app = await db.application.create({
      data: {
        jobId: opts.jobId, candidateId: cand.id, stage, stageUpdatedAt,
        createdAt: opts.appliedAt, updatedAt: stageUpdatedAt,
        rejectedAt: isRejected ? opts.rejected!.at : null,
        rejectedReason: isRejected ? opts.rejected!.reason : null,
      },
    });

    await log(rachel.id, "application", app.id, "created",
      { jobId: opts.jobId, candidateId: cand.id, revived: false }, opts.appliedAt);
    let from: Stage = "applied";
    for (const step of opts.steps) {
      await log(rachel.id, "application", app.id,
        step.reverted ? "stage_reverted" : "stage_updated",
        { from, to: step.to }, step.at);
      from = step.to;
    }
    if (opts.rejected) {
      await log(rachel.id, "application", app.id,
        opts.rejected.batchId ? "bulk_rejected" : "rejected",
        {
          reason: opts.rejected.reason, stage,
          ...(opts.rejected.batchId ? { batchId: opts.rejected.batchId } : {}),
        },
        opts.rejected.at);
    }
    if (opts.unrejectedAt && opts.rejected) {
      await log(demo.id, "application", app.id, "unrejected",
        { stage, previousReason: opts.rejected.reason }, opts.unrejectedAt);
    }
    return { app, cand };
  }

  async function interview(opts: {
    applicationId: string; interviewerId: string; type: InterviewType;
    scheduledAt: Date; createdAt: Date;
    status?: "scheduled" | "completed" | "cancelled";
    scorecard?: { rating: number; recommendation: Recommendation; notes: string; at: Date };
  }) {
    const iv = await db.interview.create({
      data: {
        applicationId: opts.applicationId, interviewerId: opts.interviewerId,
        type: opts.type, scheduledAt: opts.scheduledAt,
        status: opts.scorecard ? "completed" : (opts.status ?? "scheduled"),
        createdAt: opts.createdAt,
      },
    });
    await log(rachel.id, "interview", iv.id, "interview_scheduled",
      { applicationId: opts.applicationId, interviewerId: opts.interviewerId, type: opts.type, scheduledAt: opts.scheduledAt.toISOString() },
      opts.createdAt);
    if (opts.status === "cancelled") {
      await log(rachel.id, "interview", iv.id, "interview_cancelled",
        { applicationId: opts.applicationId }, new Date(opts.scheduledAt.getTime() - 36e5));
    }
    if (opts.scorecard) {
      await db.scorecard.create({
        data: {
          interviewId: iv.id, submittedById: opts.interviewerId,
          rating: opts.scorecard.rating, recommendation: opts.scorecard.recommendation,
          notes: opts.scorecard.notes, createdAt: opts.scorecard.at,
        },
      });
      await log(opts.interviewerId, "interview", iv.id, "scorecard_submitted",
        { applicationId: opts.applicationId, rating: opts.scorecard.rating, recommendation: opts.scorecard.recommendation },
        opts.scorecard.at);
    }
    return iv;
  }

  // ---- Senior Backend Engineer: the showcase pipeline ----
  // Hire 1, clean path: 28 days to hire.
  await application({
    jobId: backend.id, candidateName: "Amara Okafor", email: "amara.okafor@example.com",
    source: "Referral", tags: ["golang", "distributed-systems"], appliedAt: daysAgo(40),
    steps: [
      { to: "screening", at: daysAgo(36) }, { to: "interview", at: daysAgo(30) },
      { to: "offer", at: daysAgo(20) }, { to: "hired", at: daysAgo(12) },
    ],
  });
  // Hire 2, WITH a reverted stage: naive 30d, excluding-reverted 26d.
  const ben = await application({
    jobId: backend.id, candidateName: "Ben Kowalski", email: "ben.kowalski@example.com",
    source: "LinkedIn", tags: ["rust", "platform"], appliedAt: daysAgo(35),
    steps: [
      { to: "screening", at: daysAgo(32) }, { to: "interview", at: daysAgo(26) },
      { to: "offer", at: daysAgo(22) },
      { to: "interview", at: daysAgo(18), reverted: true }, // extra loop requested
      { to: "offer", at: daysAgo(14) }, { to: "hired", at: daysAgo(5) },
    ],
  });
  await interview({
    applicationId: ben.app.id, interviewerId: marcus.id, type: "technical",
    scheduledAt: daysAgo(16), createdAt: daysAgo(18),
    scorecard: { rating: 5, recommendation: "strong_yes", notes: "Second systems round removed all doubt: excellent failure-mode reasoning, pragmatic about migration costs. Hire.", at: daysAgo(15) },
  });
  // Offer stage.
  await application({
    jobId: backend.id, candidateName: "Chen Wei", email: "chen.wei@example.com",
    source: "Job board", tags: ["python", "kafka"], appliedAt: daysAgo(20),
    steps: [
      { to: "screening", at: daysAgo(17) }, { to: "interview", at: daysAgo(10) },
      { to: "offer", at: daysAgo(3) },
    ],
  });
  // Interview stage with a completed scorecard AND an upcoming round.
  const divya = await application({
    jobId: backend.id, candidateName: "Divya Sharma", email: "divya.sharma@example.com",
    source: "Referral", tags: ["java", "aws"], appliedAt: daysAgo(15),
    steps: [{ to: "screening", at: daysAgo(12) }, { to: "interview", at: daysAgo(8) }],
  });
  await interview({
    applicationId: divya.app.id, interviewerId: marcus.id, type: "phone",
    scheduledAt: daysAgo(6), createdAt: daysAgo(8),
    scorecard: { rating: 4, recommendation: "yes", notes: "Strong on service design and observability; verify depth on data modelling in the technical round.", at: daysAgo(6) },
  });
  await interview({
    applicationId: divya.app.id, interviewerId: priya.id, type: "technical",
    scheduledAt: daysAhead(2), createdAt: daysAgo(4),
  });
  // Interview stage, one cancelled + one rescheduled round.
  const eli = await application({
    jobId: backend.id, candidateName: "Eli Rosen", email: "eli.rosen@example.com",
    source: "Website", tags: ["typescript", "node"], appliedAt: daysAgo(14),
    steps: [{ to: "screening", at: daysAgo(11) }, { to: "interview", at: daysAgo(7) }],
  });
  await interview({
    applicationId: eli.app.id, interviewerId: marcus.id, type: "phone",
    scheduledAt: daysAgo(4), createdAt: daysAgo(7), status: "cancelled",
  });
  await interview({
    applicationId: eli.app.id, interviewerId: marcus.id, type: "phone",
    scheduledAt: daysAhead(1), createdAt: daysAgo(3),
  });
  // Screening.
  await application({
    jobId: backend.id, candidateName: "Fatima Hassan", email: "fatima.hassan@example.com",
    source: "LinkedIn", tags: ["go", "kubernetes"], appliedAt: daysAgo(9),
    steps: [{ to: "screening", at: daysAgo(6) }],
  });
  // REJECTED then UNREJECTED - active at screening, trail shows both.
  await application({
    jobId: backend.id, candidateName: "Gustavo Lima", email: "gustavo.lima@example.com",
    source: "Recruiter outreach", tags: ["elixir"], appliedAt: daysAgo(13),
    steps: [{ to: "screening", at: daysAgo(10) }],
    rejected: { at: daysAgo(8), reason: "Salary expectations outside band" },
    unrejectedAt: daysAgo(6), // band was adjusted after re-scope
  });
  // Applied.
  await application({
    jobId: backend.id, candidateName: "Hana Kim", email: "hana.kim@example.com",
    source: "Job board", tags: ["python"], appliedAt: daysAgo(4), steps: [],
  });
  await application({
    jobId: backend.id, candidateName: "Igor Petrov", email: "igor.petrov@example.com",
    source: "Website", tags: ["c++", "low-latency"], appliedAt: daysAgo(2), steps: [],
  });
  // BULK rejection: two applications share one batchId.
  const batchId = randomUUID();
  for (const [name, email] of [
    ["Jasmine Doe", "jasmine.doe@example.com"],
    ["Kofi Mensah", "kofi.mensah@example.com"],
  ] as const) {
    await application({
      jobId: backend.id, candidateName: name, email,
      source: "Job board", tags: [], appliedAt: daysAgo(24), steps: [],
      rejected: { at: daysAgo(10), reason: "Position requirements changed after re-scope", batchId },
    });
  }
  // Individual rejection FROM interview (feeds funnel drop-off) + scorecard.
  const lena = await application({
    jobId: backend.id, candidateName: "Lena Novak", email: "lena.novak@example.com",
    source: "LinkedIn", tags: ["java"], appliedAt: daysAgo(28),
    steps: [{ to: "screening", at: daysAgo(25) }, { to: "interview", at: daysAgo(19) }],
    rejected: { at: daysAgo(7), reason: "Stronger candidates in the final loop" },
  });
  await interview({
    applicationId: lena.app.id, interviewerId: priya.id, type: "technical",
    scheduledAt: daysAgo(9), createdAt: daysAgo(12),
    scorecard: { rating: 3, recommendation: "no", notes: "Solid fundamentals but shallow on distributed consistency; better fit for a mid-level opening.", at: daysAgo(9) },
  });

  // ---- Product Designer ----
  await application({
    jobId: designer.id, candidateName: "Maria Santos", email: "maria.santos@example.com",
    source: "Referral", tags: ["figma", "design-systems"], appliedAt: daysAgo(25),
    steps: [
      { to: "screening", at: daysAgo(22) }, { to: "interview", at: daysAgo(16) },
      { to: "offer", at: daysAgo(13) }, { to: "hired", at: daysAgo(10) },
    ],
  }).then(async ({ app }) => {
    await interview({
      applicationId: app.id, interviewerId: marcus.id, type: "onsite",
      scheduledAt: daysAgo(14), createdAt: daysAgo(16),
      scorecard: { rating: 5, recommendation: "strong_yes", notes: "Portfolio depth plus real systems thinking; the pairing exercise was the best we've seen this cycle.", at: daysAgo(13) },
    });
  });
  const noah = await application({
    jobId: designer.id, candidateName: "Noah Williams", email: "noah.williams@example.com",
    source: "Website", tags: ["ux-research"], appliedAt: daysAgo(12),
    steps: [{ to: "screening", at: daysAgo(9) }, { to: "interview", at: daysAgo(5) }],
  });
  await interview({
    applicationId: noah.app.id, interviewerId: priya.id, type: "onsite",
    scheduledAt: daysAhead(3), createdAt: daysAgo(2),
  });
  await application({
    jobId: designer.id, candidateName: "Olivia Brown", email: "olivia.brown@example.com",
    source: "LinkedIn", tags: ["figma"], appliedAt: daysAgo(7),
    steps: [{ to: "screening", at: daysAgo(4) }],
  });
  await application({
    jobId: designer.id, candidateName: "Pierre Dubois", email: "pierre.dubois@example.com",
    source: "Job board", tags: [], appliedAt: daysAgo(1), steps: [],
  });
  await application({
    jobId: designer.id, candidateName: "Quinn Taylor", email: "quinn.taylor@example.com",
    source: "Job board", tags: ["branding"], appliedAt: daysAgo(18),
    steps: [{ to: "screening", at: daysAgo(15) }],
    rejected: { at: daysAgo(11), reason: "Portfolio focused on brand work; role needs product depth" },
  });

  // ---- Data Analyst (closed job with a past hire) ----
  await application({
    jobId: analyst.id, candidateName: "Rosa Garcia", email: "rosa.garcia@example.com",
    source: "Referral", tags: ["sql", "dbt"], appliedAt: daysAgo(60),
    steps: [
      { to: "screening", at: daysAgo(56) }, { to: "interview", at: daysAgo(50) },
      { to: "offer", at: daysAgo(42) }, { to: "hired", at: daysAgo(35) },
    ],
  });

  const counts = {
    users: await db.user.count({ where: { orgId: org.id } }),
    jobs: await db.job.count({ where: { orgId: org.id } }),
    candidates: await db.candidate.count({ where: { orgId: org.id } }),
    applications: await db.application.count({ where: { job: { orgId: org.id } } }),
    interviews: await db.interview.count({ where: { application: { job: { orgId: org.id } } } }),
    scorecards: await db.scorecard.count({ where: { interview: { application: { job: { orgId: org.id } } } } }),
    activityLogs: await db.activityLog.count({ where: { orgId: org.id } }),
  };
  console.log("Seeded:", JSON.stringify(counts));
  console.log("Demo login: demo@demo.com / demo1234");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
