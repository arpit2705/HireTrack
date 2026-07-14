import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, JobsIllustration } from "@/components/empty-state";
import { requireUser } from "@/lib/auth/request";
import { listJobs } from "@/lib/jobs/queries";
import {
  parseJobListQuery,
  type JobListQuery,
  type JobStatus,
} from "@/lib/schemas";

export const metadata: Metadata = { title: "Jobs" };

const STATUS_BADGE: Record<JobStatus, "status-open" | "status-draft" | "status-closed"> = {
  open: "status-open",
  draft: "status-draft",
  closed: "status-closed",
};

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

// Shared select/filter control class
const selectClass =
  "flex h-9 rounded-xl border border-[#E3E1F5] bg-white px-3 py-1 text-sm text-foreground outline-none " +
  "transition-all duration-150 focus-visible:border-[#FF7A59] focus-visible:ring-3 focus-visible:ring-[#FF7A59]/20 focus-visible:bg-[#FFFAF8]";

function queryString(
  query: JobListQuery,
  overrides: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  const merged = {
    q: query.q,
    status: query.status,
    sort: query.sort === "created_desc" ? undefined : query.sort,
    ...overrides,
  };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }

  let query: JobListQuery;
  try {
    query = parseJobListQuery(params);
  } catch {
    // Hand-mangled URL params: recover to the clean list, not an error page.
    redirect("/jobs");
  }

  const user = await requireUser();
  const { items, nextCursor } = await listJobs(user.orgId, query);
  const hasFilters = Boolean(query.q || query.status);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-3xl font-bold tracking-tight text-foreground">Jobs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {items.length > 0
              ? `${items.length} requisition${items.length !== 1 ? "s" : ""}`
              : "Build your hiring pipeline"}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/jobs/new">Create job</Link>
        </Button>
      </div>

      {/* Filter form */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs space-y-1.5">
          <label htmlFor="q" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Search
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Title, department, location…"
            defaultValue={query.q ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={query.status ?? ""}
            className={`${selectClass} min-w-28`}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sort" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sort
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={query.sort}
            className={`${selectClass} min-w-36`}
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="title_asc">Title A–Z</option>
            <option value="title_desc">Title Z–A</option>
          </select>
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/jobs">Clear</Link>
          </Button>
        ) : null}
      </form>

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState
          illustration={<JobsIllustration />}
          heading={hasFilters ? "No jobs match your filters" : "No jobs yet"}
          subtext={
            hasFilters
              ? "Try a different search, or clear the filters to see every job."
              : "Create your first job requisition and start building your pipeline."
          }
          action={
            hasFilters ? (
              <Button asChild variant="secondary">
                <Link href="/jobs">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/jobs/new">Create your first job</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((job, i) => (
                <TableRow
                  key={job.id}
                  className="animate-row-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <TableCell>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors duration-150 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {job.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{job.department}</TableCell>
                  <TableCell className="text-muted-foreground">{job.location}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[job.status]}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-jetbrains text-xs text-muted-foreground">
                    {dateFormat.format(job.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button asChild variant="secondary">
                <Link href={`/jobs${queryString(query, { cursor: nextCursor })}`}>
                  Next page
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
