"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/form";
import {
  createCandidateRequest,
  messageFor,
  parseTagsInput,
  uploadResumeRequest,
} from "@/lib/candidates/client";
import { candidateCreateSchema } from "@/lib/schemas";
import { MAX_RESUME_BYTES } from "@/lib/uploads/resume";

export default function NewCandidatePage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("resume");

    // Client-side pre-checks (UX only - the server re-validates everything).
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_RESUME_BYTES) {
        setFieldErrors({ resume: "That file is over the 5 MB limit." });
        return;
      }
    }

    const parsed = candidateCreateSchema.safeParse({
      name: data.get("name"),
      email: data.get("email"),
      phone: (data.get("phone") as string) || null,
      source: (data.get("source") as string) || null,
      tags: parseTagsInput((data.get("tags") as string) ?? ""),
    });
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      setFieldErrors(
        Object.fromEntries(
          Object.entries(errors).map(([key, messages]) => [
            key,
            messages?.[0] ?? "Invalid value",
          ]),
        ),
      );
      return;
    }

    setPending(true);
    const created = await createCandidateRequest(parsed.data);
    if (!created.ok) {
      setPending(false);
      if (created.error === "email_exists") {
        setFieldErrors({ email: messageFor("email_exists") });
      } else if (created.fieldErrors) {
        setFieldErrors(created.fieldErrors);
      } else {
        setFormError(messageFor(created.error));
      }
      return;
    }

    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadResumeRequest(created.data.id, file);
      if (!uploaded.ok) {
        // Candidate exists; resume failed. Land on the detail page where the
        // upload can be retried, with the reason in the query for display.
        router.push(
          `/candidates/${created.data.id}?resume_error=${uploaded.error}`,
        );
        router.refresh();
        return;
      }
    }

    router.push(`/candidates/${created.data.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/candidates"
          className="rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Back to candidates
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add candidate</h1>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required aria-invalid={!!fieldErrors.name} />
          {fieldErrors.name ? (
            <p className="text-sm text-destructive">{fieldErrors.name}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email ? (
            <p className="text-sm text-destructive">{fieldErrors.email}</p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source (optional)</Label>
            <Input id="source" name="source" placeholder="Referral, LinkedIn…" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated, optional)</Label>
          <Input id="tags" name="tags" placeholder="backend, senior" />
          {fieldErrors.tags ? (
            <p className="text-sm text-destructive">{fieldErrors.tags}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="resume">Resume (optional — PDF or Word, max 5 MB)</Label>
          <Input
            id="resume"
            name="resume"
            type="file"
            accept=".pdf,.doc,.docx"
            aria-invalid={!!fieldErrors.resume}
          />
          {fieldErrors.resume ? (
            <p className="text-sm text-destructive">{fieldErrors.resume}</p>
          ) : null}
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add candidate"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/candidates">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
