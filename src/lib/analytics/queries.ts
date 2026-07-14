import type { RequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import { funnelCounts, type FunnelStage } from "@/lib/analytics/funnel";
import {
  timeToHireMs,
  type StageEvent,
} from "@/lib/analytics/time-to-hire";
import type { Stage } from "@/lib/schemas";

// Analytics scope follows the permission matrix: admin sees the whole org,
// recruiters see the jobs THEY created ("own jobs"). Hiring managers never
// reach this module (analytics:view excludes them at the proxy).

const DAY_MS = 24 * 60 * 60 * 1000;

function jobScope(user: RequestUser) {
  return user.role === "admin"
    ? { orgId: user.orgId }
    : { orgId: user.orgId, createdById: user.userId };
}

export interface AnalyticsData {
  scope: "org" | "own_jobs";
  jobs: { total: number; open: number };
  applications: number;
  hires: number;
  funnel: FunnelStage[];
  sources: { source: string; count: number }[];
  timeToHire: {
    hires: number;
    avgDaysExcludingReverted: number | null;
    avgDaysNaive: number | null;
  };
}

export async function getAnalytics(
  user: RequestUser,
  jobId?: string,
): Promise<AnalyticsData | null> {
  const scope = jobScope(user);
  const jobWhere = { ...scope, ...(jobId ? { id: jobId } : {}) };

  if (jobId) {
    // Out-of-scope jobId (cross-org, or another recruiter's job) -> null -> 404.
    const job = await db.job.findFirst({ where: jobWhere });
    if (!job) return null;
  }

  const [totalJobs, openJobs, apps] = await Promise.all([
    db.job.count({ where: jobWhere }),
    db.job.count({ where: { ...jobWhere, status: "open" } }),
    db.application.findMany({
      where: { deletedAt: null, job: jobWhere },
      select: {
        id: true,
        stage: true,
        rejectedAt: true,
        createdAt: true,
        candidate: { select: { source: true } },
      },
    }),
  ]);

  const sourceMap = new Map<string, number>();
  for (const app of apps) {
    const source = app.candidate.source?.trim() || "Unknown";
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
  }

  const hired = apps.filter((app) => app.stage === "hired" && !app.rejectedAt);
  let avgExcluding: number | null = null;
  let avgNaive: number | null = null;

  if (hired.length > 0) {
    const logs = await db.activityLog.findMany({
      where: {
        orgId: user.orgId,
        entityType: "application",
        entityId: { in: hired.map((app) => app.id) },
        action: { in: ["stage_updated", "stage_reverted"] },
      },
      orderBy: { createdAt: "asc" },
      select: { entityId: true, action: true, metadata: true, createdAt: true },
    });

    const eventsByApp = new Map<string, StageEvent[]>();
    for (const log of logs) {
      const to = (log.metadata as { to?: Stage } | null)?.to;
      if (!to) continue;
      const events = eventsByApp.get(log.entityId) ?? [];
      events.push({
        action: log.action as StageEvent["action"],
        to,
        at: log.createdAt,
      });
      eventsByApp.set(log.entityId, events);
    }

    const excluding: number[] = [];
    const naive: number[] = [];
    for (const app of hired) {
      const events = eventsByApp.get(app.id) ?? [];
      const tth = timeToHireMs(app.createdAt, events);
      const hireEvent = events.find((event) => event.to === "hired");
      if (tth !== null && hireEvent) {
        excluding.push(tth);
        naive.push(hireEvent.at.getTime() - app.createdAt.getTime());
      }
    }
    if (excluding.length > 0) {
      const avg = (values: number[]) =>
        values.reduce((sum, value) => sum + value, 0) /
        values.length /
        DAY_MS;
      avgExcluding = avg(excluding);
      avgNaive = avg(naive);
    }
  }

  return {
    scope: user.role === "admin" ? "org" : "own_jobs",
    jobs: { total: totalJobs, open: openJobs },
    applications: apps.length,
    hires: hired.length,
    funnel: funnelCounts(apps),
    sources: [...sourceMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    timeToHire: {
      hires: hired.length,
      avgDaysExcludingReverted: avgExcluding,
      avgDaysNaive: avgNaive,
    },
  };
}
