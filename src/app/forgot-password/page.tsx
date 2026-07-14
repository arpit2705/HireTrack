"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, Field, FormAlert, SubmitButton } from "@/components/form";
import { resetRequestSchema } from "@/lib/schemas";

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setEmailError(undefined);

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = resetRequestSchema.safeParse(data);
    if (!parsed.success) {
      setEmailError("Enter a valid email address");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 429) {
        setFormError("Too many reset requests. Try again later.");
        return;
      }
      if (!response.ok) {
        setFormError("Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <FormAlert tone="success">
          If an account exists for that address, a reset link is on its way.
          The link expires after 24 hours.
        </FormAlert>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/login"
            className="rounded font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-400"
          >
            Back to login
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={emailError}
        />
        <SubmitButton pending={pending}>Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Remembered it?{" "}
        <Link
          href="/login"
          className="rounded font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-400"
        >
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
