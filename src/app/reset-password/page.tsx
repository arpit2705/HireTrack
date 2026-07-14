"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, Field, FormAlert, SubmitButton } from "@/components/form";
import { resetConfirmSchema } from "@/lib/schemas";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setPasswordError(undefined);

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = resetConfirmSchema.safeParse({ ...data, token });
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      setPasswordError(errors.password?.[0]);
      if (errors.token) setFormError("This reset link is malformed.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        setDone(true);
        return;
      }
      const body = (await response.json()) as { error?: string };
      setFormError(
        body.error === "expired_token"
          ? "This reset link has expired. Request a new one."
          : "This reset link is invalid or was already used.",
      );
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Reset link invalid">
        <FormAlert tone="error">
          This page needs the link from your reset email.
        </FormAlert>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/forgot-password"
            className="rounded font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-400"
          >
            Request a new reset link
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <FormAlert tone="success">
          Your password has been changed and all your sessions were logged
          out. Log in with the new password.
        </FormAlert>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/login"
            className="rounded font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-400"
          >
            Go to login
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          error={passwordError}
        />
        <SubmitButton pending={pending}>Update password</SubmitButton>
      </form>
    </AuthCard>
  );
}

function ResetShell() {
  return (
    <AuthCard title="Choose a new password">
      <div aria-busy="true" className="space-y-4">
        <div className="h-11 w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetShell />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
