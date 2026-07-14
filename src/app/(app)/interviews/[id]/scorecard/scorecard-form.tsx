"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/form";
import { scorecardCreateSchema } from "@/lib/schemas";

const RECOMMENDATIONS = [
  { value: "strong_yes", label: "Strong yes" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "strong_no", label: "Strong no" },
] as const;

export function ScorecardForm({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const data = new FormData(event.currentTarget);
    const parsed = scorecardCreateSchema.safeParse({
      rating: Number(data.get("rating")),
      recommendation: data.get("recommendation"),
      notes: data.get("notes"),
    });
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      setError(
        issues.rating?.[0] ??
          issues.recommendation?.[0] ??
          issues.notes?.[0] ??
          "Fill in every field.",
      );
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/scorecard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 201) {
        router.push("/interviews");
        router.refresh();
        return;
      }
      const body = (await response.json()) as { error?: string };
      setError(
        body.error === "scorecard_exists"
          ? "A scorecard was already submitted for this interview."
          : body.error === "not_your_interview"
            ? "Only the assigned interviewer can submit this scorecard."
            : "Submitting failed. Please try again.",
      );
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Rating</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border text-base font-medium has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground motion-safe:transition-colors motion-safe:duration-150"
            >
              <input
                type="radio"
                name="rating"
                value={value}
                required
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="recommendation">Recommendation</Label>
        <select
          id="recommendation"
          name="recommendation"
          required
          defaultValue=""
          className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="" disabled>
            Choose…
          </option>
          {RECOMMENDATIONS.map((rec) => (
            <option key={rec.value} value={rec.value}>
              {rec.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          required
          rows={6}
          placeholder="Structured feedback: strengths, concerns, specific examples…"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Submitting…" : "Submit scorecard"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Scorecards are final: one per interview, no edits after submission.
      </p>
    </form>
  );
}
