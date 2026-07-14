import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/form";
import { getCandidateTimeline } from "@/lib/activity/queries";
import { requireUser } from "@/lib/auth/request";
import { getCandidate, serializeCandidate } from "@/lib/candidates/queries";
import { hasAssignedInterview } from "@/lib/interviews/queries";
import { CandidateEditor } from "./candidate-editor";

export const metadata: Metadata = { title: "Candidate" };

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resume_error?: string }>;
}) {
  const { id } = await params;
  const { resume_error } = await searchParams;
  const user = await requireUser();

  const row = await getCandidate(user.orgId, id);
  if (!row) notFound();
  const candidate = serializeCandidate(row);

  // Hiring managers: row-level access via assigned interviews ONLY, with an
  // explicit denial - never a silently empty page (plan.md section 10).
  if (user.role === "hiring_manager") {
    if (!(await hasAssignedInterview(user.userId, candidate.id))) {
      return (
        <div className="mx-auto max-w-xl space-y-6">
          <h1 className="text-2xl font-semibold">No access to this candidate</h1>
          <FormAlert tone="error">
            You can only view candidates for interviews assigned to you. If
            you believe you should have access, ask a recruiter to assign you
            to one of this candidate&apos;s interviews.
          </FormAlert>
          <Link
            href="/interviews"
            className="inline-block rounded text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            ← Back to my interviews
          </Link>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link
            href="/interviews"
            className="rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            ← Back to my interviews
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{candidate.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {candidate.email}
            {candidate.phone ? ` · ${candidate.phone}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {candidate.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Resume</h2>
          {candidate.resumeUrl ? (
            <p className="mt-2 text-sm">
              <a
                href={candidate.resumeUrl}
                className="rounded font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Download resume
              </a>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No resume on file.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/candidates"
          className="rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Back to candidates
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{candidate.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {candidate.email}
          {candidate.phone ? ` · ${candidate.phone}` : ""}
          {candidate.source ? ` · via ${candidate.source}` : ""}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Added {dateFormat.format(candidate.createdAt)}
        </p>
      </div>

      <CandidateEditor
        candidate={{
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          source: candidate.source,
          tags: candidate.tags,
          resumeUrl: candidate.resumeUrl,
        }}
        initialResumeError={resume_error ?? null}
      />

      <CandidateTimeline orgId={user.orgId} candidateId={candidate.id} />
    </div>
  );
}

async function CandidateTimeline({
  orgId,
  candidateId,
}: {
  orgId: string;
  candidateId: string;
}) {
  const entries = await getCandidateTimeline(orgId, candidateId);

  return (
    <section aria-label="Activity timeline" className="space-y-3">
      <h2 className="text-xl font-semibold">Timeline</h2>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No activity yet — actions on this candidate and their applications
          appear here.
        </p>
      ) : (
        <ol className="space-y-0 rounded-xl border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-3 text-sm last:border-b-0"
            >
              <span className="flex items-center gap-2">
                {entry.isBulk ? (
                  <Badge variant="secondary" className="rounded-full">
                    bulk
                  </Badge>
                ) : null}
                <span>{entry.description}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {entry.actorName} ·{" "}
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(entry.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
