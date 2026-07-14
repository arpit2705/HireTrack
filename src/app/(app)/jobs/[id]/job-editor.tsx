"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/form";
import { jobUpdateSchema, type JobStatus } from "@/lib/schemas";

interface JobEditorProps {
  job: {
    id: string;
    title: string;
    department: string;
    location: string;
    status: JobStatus;
  };
}

const STATUS_ACTIONS: Record<
  JobStatus,
  { to: JobStatus; label: string; variant: "default" | "secondary" }[]
> = {
  draft: [
    { to: "open", label: "Publish job", variant: "default" },
    { to: "closed", label: "Close job", variant: "secondary" },
  ],
  open: [{ to: "closed", label: "Close job", variant: "secondary" }],
  closed: [{ to: "open", label: "Reopen job", variant: "default" }],
};

export function JobEditor({ job }: JobEditorProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  async function patch(body: Record<string, unknown>) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setMessage({ tone: "success", text: "Saved." });
        router.refresh();
        return;
      }
      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (response.status === 403 && data.error === "email_not_verified") {
        setMessage({
          tone: "error",
          text: "Verify your email before editing jobs.",
        });
      } else if (response.status === 409) {
        setMessage({
          tone: "error",
          text: data.message ?? "That status change isn't allowed.",
        });
      } else {
        setMessage({ tone: "error", text: "Saving failed. Please try again." });
      }
    } catch {
      setMessage({
        tone: "error",
        text: "Could not reach the server. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = jobUpdateSchema.safeParse(data);
    if (!parsed.success) {
      setMessage({ tone: "error", text: "Fix the highlighted fields first." });
      return;
    }
    await patch(parsed.data);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <h2 className="text-xl font-semibold">Edit details</h2>
        {message ? (
          <FormAlert tone={message.tone}>{message.text}</FormAlert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={job.title} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              name="department"
              defaultValue={job.department}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={job.location}
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Requisition status
        </h2>
        <div className="flex gap-3">
          {STATUS_ACTIONS[job.status].map((action) => (
            <Button
              key={action.to}
              variant={action.variant}
              disabled={pending}
              onClick={() => patch({ status: action.to })}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
