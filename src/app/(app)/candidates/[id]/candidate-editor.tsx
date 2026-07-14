"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/form";
import {
  messageFor,
  parseTagsInput,
  updateCandidateRequest,
  uploadResumeRequest,
} from "@/lib/candidates/client";
import { candidateUpdateSchema } from "@/lib/schemas";
import { MAX_RESUME_BYTES } from "@/lib/uploads/resume";

interface CandidateEditorProps {
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    source: string | null;
    tags: string[];
    resumeUrl: string | null;
  };
  initialResumeError: string | null;
}

export function CandidateEditor({
  candidate,
  initialResumeError,
}: CandidateEditorProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(
    initialResumeError
      ? { tone: "error", text: `Resume upload failed: ${messageFor(initialResumeError)}` }
      : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const data = new FormData(event.currentTarget);
    const parsed = candidateUpdateSchema.safeParse({
      name: data.get("name"),
      email: data.get("email"),
      phone: (data.get("phone") as string) || null,
      source: (data.get("source") as string) || null,
      tags: parseTagsInput((data.get("tags") as string) ?? ""),
    });
    if (!parsed.success) {
      setMessage({ tone: "error", text: "Fix the highlighted fields first." });
      return;
    }

    setPending(true);
    const result = await updateCandidateRequest(candidate.id, parsed.data);
    setPending(false);
    if (result.ok) {
      setMessage({ tone: "success", text: "Saved." });
      router.refresh();
    } else {
      setMessage({ tone: "error", text: messageFor(result.error) });
    }
  }

  async function onResumeChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setMessage(null);

    if (file.size > MAX_RESUME_BYTES) {
      setMessage({ tone: "error", text: messageFor("too_large") });
      return;
    }

    setPending(true);
    const result = await uploadResumeRequest(candidate.id, file);
    setPending(false);
    if (result.ok) {
      setMessage({ tone: "success", text: "Resume uploaded." });
      router.refresh();
    } else {
      setMessage({ tone: "error", text: messageFor(result.error) });
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <FormAlert tone={message.tone}>{message.text}</FormAlert>
      ) : null}

      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Resume</h2>
        {candidate.resumeUrl ? (
          <p className="text-sm">
            <a
              href={candidate.resumeUrl}
              className="rounded font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Download current resume
            </a>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No resume on file.</p>
        )}
        <div className="space-y-2">
          <Label htmlFor="resume-file">
            {candidate.resumeUrl ? "Replace resume" : "Upload resume"} (PDF or
            Word, max 5 MB)
          </Label>
          <Input
            id="resume-file"
            type="file"
            accept=".pdf,.doc,.docx"
            disabled={pending}
            onChange={(event) => onResumeChange(event.target.files)}
          />
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <h2 className="text-xl font-semibold">Edit details</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" defaultValue={candidate.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={candidate.email}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={candidate.phone ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              name="source"
              defaultValue={candidate.source ?? ""}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            name="tags"
            defaultValue={candidate.tags.join(", ")}
          />
          <div className="flex flex-wrap gap-1">
            {candidate.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
