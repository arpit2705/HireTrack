import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/request";
import { getJob } from "@/lib/jobs/queries";
import type { JobStatus } from "@/lib/schemas";
import { KanbanBoard } from "./board/kanban-board";
import { JobEditor } from "./job-editor";

export const metadata: Metadata = { title: "Job detail" };

const STATUS_BADGE: Record<JobStatus, "default" | "secondary" | "outline"> = {
  open: "default",
  draft: "outline",
  closed: "secondary",
};

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // Org-scoped lookup: cross-org ids land on the 404 page, not a 403.
  const job = await getJob(user.orgId, id);
  if (!job) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/jobs"
          className="rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Back to jobs
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <Badge variant={STATUS_BADGE[job.status]}>{job.status}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {job.department} · {job.location}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">Created: </dt>
            <dd className="inline">{dateFormat.format(job.createdAt)}</dd>
          </div>
          {job.closedAt ? (
            <div>
              <dt className="inline font-medium text-foreground">Closed: </dt>
              <dd className="inline">{dateFormat.format(job.closedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <section aria-label="Pipeline board" className="space-y-4">
        <h2 className="text-xl font-semibold">Pipeline</h2>
        <KanbanBoard jobId={job.id} />
      </section>

      <div className="mx-auto w-full max-w-2xl">
        <JobEditor
          job={{
            id: job.id,
            title: job.title,
            department: job.department,
            location: job.location,
            status: job.status,
          }}
        />
      </div>
    </div>
  );
}
