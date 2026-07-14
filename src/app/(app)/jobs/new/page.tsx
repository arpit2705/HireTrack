"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/form";
import { jobCreateSchema, type JobCreateInput } from "@/lib/schemas";

type FieldName = keyof JobCreateInput;

export default function NewJobPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = jobCreateSchema.safeParse(data);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        title: errors.title?.[0],
        department: errors.department?.[0],
        location: errors.location?.[0],
      });
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 201) {
        const job = (await response.json()) as { id: string };
        router.push(`/jobs/${job.id}`);
        router.refresh();
        return;
      }
      if (response.status === 403) {
        const body = (await response.json()) as { error?: string };
        setFormError(
          body.error === "email_not_verified"
            ? "Verify your email before creating jobs — check your inbox."
            : "You don't have permission to create jobs.",
        );
        return;
      }
      setFormError("Something went wrong. Please try again.");
    } catch {
      setFormError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/jobs"
          className="rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Back to jobs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Create job</h1>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required aria-invalid={!!fieldErrors.title} />
          {fieldErrors.title ? (
            <p className="text-sm text-destructive">{fieldErrors.title}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            name="department"
            required
            aria-invalid={!!fieldErrors.department}
          />
          {fieldErrors.department ? (
            <p className="text-sm text-destructive">{fieldErrors.department}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            required
            aria-invalid={!!fieldErrors.location}
          />
          {fieldErrors.location ? (
            <p className="text-sm text-destructive">{fieldErrors.location}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Initial status</Label>
          <select
            id="status"
            name="status"
            defaultValue="draft"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="draft">Draft — not visible in the pipeline yet</option>
            <option value="open">Open — start accepting candidates</option>
          </select>
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create job"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/jobs">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
