"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/form";
import { interviewCreateSchema } from "@/lib/schemas";

const selectClass =
  "flex h-9 w-full rounded-xl border border-[#E3E1F5] bg-white px-3 py-1 text-sm text-foreground outline-none " +
  "transition-all duration-150 focus-visible:border-[#FF7A59] focus-visible:ring-3 focus-visible:ring-[#FF7A59]/20 " +
  "focus-visible:bg-[#FFFAF8] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#F0F0ED]";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`http_${response.status}`);
  return response.json() as Promise<T>;
}

export function InterviewScheduler() {
  const router = useRouter();
  const [jobId, setJobId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  const jobs = useQuery({
    queryKey: ["scheduler-jobs"],
    queryFn: () =>
      getJson<{ items: { id: string; title: string }[] }>(
        "/api/jobs?status=open&limit=50",
      ),
  });

  const board = useQuery({
    queryKey: ["scheduler-board", jobId],
    enabled: Boolean(jobId),
    queryFn: () =>
      getJson<{
        active: { id: string; candidate: { name: string } }[];
      }>(`/api/jobs/${jobId}/applications`),
  });

  const interviewers = useQuery({
    queryKey: ["scheduler-interviewers"],
    queryFn: () =>
      getJson<{ items: { id: string; name: string; email: string }[] }>(
        "/api/users/interviewers",
      ),
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = interviewCreateSchema.safeParse({
      applicationId: data.applicationId,
      interviewerId: data.interviewerId,
      scheduledAt: data.scheduledAt,
      type: data.type,
    });
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      setMessage({
        tone: "error",
        text:
          issues.interviewerId?.[0] ??
          issues.applicationId?.[0] ??
          issues.scheduledAt?.[0] ??
          "Fill in every field.",
      });
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          scheduledAt: parsed.data.scheduledAt.toISOString(),
        }),
      });
      if (response.status === 201) {
        setMessage({ tone: "success", text: "Interview scheduled." });
        router.refresh();
        return;
      }
      const body = (await response.json()) as { error?: string };
      setMessage({
        tone: "error",
        text:
          body.error === "invalid_interviewer"
            ? "Pick a valid hiring manager from your organization."
            : body.error === "application_rejected"
              ? "That candidate has been rejected — reinstate them first."
              : "Scheduling failed. Please try again.",
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Could not reach the server. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  const noInterviewers =
    interviewers.isSuccess && interviewers.data.items.length === 0;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-[#E3E1F5] bg-white p-6 shadow-card"
      aria-label="Schedule an interview"
    >
      {/* Form header */}
      <div className="mb-5">
        <h2 className="font-grotesk text-lg font-semibold text-foreground">
          Schedule an interview
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pick a job, candidate, interviewer, and time.
        </p>
      </div>

      {message ? <div className="mb-4"><FormAlert tone={message.tone}>{message.text}</FormAlert></div> : null}
      {noInterviewers ? (
        <div className="mb-4">
          <FormAlert tone="error">
            Your organization has no hiring managers yet — an admin can invite
            one from Settings, or seed data provides them in the demo.
          </FormAlert>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <label htmlFor="sched-job" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Job
          </label>
          <select
            id="sched-job"
            className={selectClass}
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
          >
            <option value="">Pick a job…</option>
            {(jobs.data?.items ?? []).map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sched-application" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Candidate
          </label>
          <select
            id="sched-application"
            name="applicationId"
            className={selectClass}
            disabled={!jobId}
            defaultValue=""
          >
            <option value="">
              {jobId ? "Pick a candidate…" : "Pick a job first"}
            </option>
            {(board.data?.active ?? []).map((application) => (
              <option key={application.id} value={application.id}>
                {application.candidate.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sched-interviewer" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Interviewer
          </label>
          <select
            id="sched-interviewer"
            name="interviewerId"
            className={selectClass}
            defaultValue=""
            required
          >
            <option value="">Pick a hiring manager…</option>
            {(interviewers.data?.items ?? []).map((interviewer) => (
              <option key={interviewer.id} value={interviewer.id}>
                {interviewer.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sched-when" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            When
          </label>
          <Input
            id="sched-when"
            name="scheduledAt"
            type="datetime-local"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sched-type" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Type
          </label>
          <select
            id="sched-type"
            name="type"
            className={selectClass}
            defaultValue="phone"
          >
            <option value="phone">Phone</option>
            <option value="technical">Technical</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
      </div>

      <div className="mt-5">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Scheduling…" : "Schedule interview"}
        </Button>
      </div>
    </form>
  );
}
