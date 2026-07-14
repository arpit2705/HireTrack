import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/form";
import { requireUser } from "@/lib/auth/request";
import { getInterview } from "@/lib/interviews/queries";
import { ScorecardForm } from "./scorecard-form";

export const metadata: Metadata = { title: "Scorecard" };

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function ScorecardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(); // proxy guarantees hiring_manager here

  const interview = await getInterview(user.orgId, id);
  if (!interview) notFound(); // cross-org or missing

  // Row-level: only the ASSIGNED interviewer, explicit denial not a 404.
  if (interview.interviewerId !== user.userId) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-semibold">Not your interview</h1>
        <FormAlert tone="error">
          This interview is assigned to {interview.interviewer.name}. Only the
          assigned interviewer can submit its scorecard.
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
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/interviews"
          className="rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Back to my interviews
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          Scorecard: {interview.application.candidate.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {interview.application.job.title} · {interview.type} interview ·{" "}
          {dateFormat.format(interview.scheduledAt)}
        </p>
      </div>

      {interview.scorecard ? (
        <div className="space-y-4 rounded-xl border p-4">
          <FormAlert tone="success">
            Scorecard submitted {dateFormat.format(interview.scorecard.createdAt)}.
            Scorecards are final — one per interview.
          </FormAlert>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium">Rating</dt>
              <dd>{interview.scorecard.rating} / 5</dd>
            </div>
            <div>
              <dt className="font-medium">Recommendation</dt>
              <dd>{interview.scorecard.recommendation.replace("_", " ")}</dd>
            </div>
            <div>
              <dt className="font-medium">Notes</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">
                {interview.scorecard.notes}
              </dd>
            </div>
          </dl>
        </div>
      ) : interview.status === "cancelled" ? (
        <FormAlert tone="error">
          This interview was cancelled — no scorecard can be submitted.
        </FormAlert>
      ) : (
        <ScorecardForm interviewId={interview.id} />
      )}
    </div>
  );
}
