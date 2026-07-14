import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, InterviewsIllustration } from "@/components/empty-state";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/request";
import { listInterviews } from "@/lib/interviews/queries";
import { CancelInterviewButton } from "./cancel-button";
import { InterviewScheduler } from "./scheduler";

export const metadata: Metadata = { title: "Interviews" };

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_BADGE = {
  scheduled: "status-scheduled",
  completed: "status-completed",
  cancelled: "status-cancelled",
} as const;

export default async function InterviewsPage() {
  const user = await requireUser();
  const interviews = await listInterviews(user);
  const canSchedule = can(user.role, "interview:schedule");
  const isHm = user.role === "hiring_manager";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-grotesk text-3xl font-bold tracking-tight text-foreground">
          {isHm ? "My interviews" : "Interviews"}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {isHm
            ? "Assigned to you as interviewer"
            : "Schedule and track your hiring interviews"}
        </p>
      </div>

      {canSchedule ? <InterviewScheduler /> : null}

      {interviews.length === 0 ? (
        <EmptyState
          illustration={<InterviewsIllustration />}
          heading={isHm ? "No interviews assigned to you yet" : "No interviews scheduled"}
          subtext={
            isHm
              ? "When a recruiter assigns you an interview, it appears here with a scorecard to fill in afterwards."
              : "Schedule the first one above: pick a job's candidate, an interviewer, and a time."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Interviewer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Scorecard</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {interviews.map((interview, i) => (
              <TableRow
                key={interview.id}
                className="animate-row-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <TableCell>
                  <Link
                    href={`/candidates/${interview.candidate.id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors duration-150 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {interview.candidate.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {interview.application.jobTitle}
                </TableCell>
                <TableCell className="font-jetbrains text-xs">
                  {dateFormat.format(interview.scheduledAt)}
                </TableCell>
                <TableCell>
                  <span className="font-jetbrains text-xs text-muted-foreground capitalize">
                    {interview.type}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {interview.interviewer.name}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[interview.status]}>
                    {interview.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {interview.scorecard ? (
                    <span className="font-jetbrains text-xs text-muted-foreground">
                      {interview.scorecard.rating}/5 ·{" "}
                      {interview.scorecard.recommendation.replace("_", " ")}
                    </span>
                  ) : isHm && interview.status === "scheduled" ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/interviews/${interview.id}/scorecard`}>
                        Submit scorecard
                      </Link>
                    </Button>
                  ) : canSchedule && interview.status === "scheduled" ? (
                    <CancelInterviewButton interviewId={interview.id} />
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
