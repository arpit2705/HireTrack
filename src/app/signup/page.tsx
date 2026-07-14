"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, Field, FormAlert, SubmitButton } from "@/components/form";
import { signupInputSchema, type SignupInput } from "@/lib/schemas";

type FieldName = keyof SignupInput;

export default function SignupPage() {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = signupInputSchema.safeParse(data);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        orgName: errors.orgName?.[0],
        name: errors.name?.[0],
        email: errors.email?.[0],
        password: errors.password?.[0],
      });
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        setSentTo(parsed.data.email);
        return;
      }
      if (response.status === 409) {
        setFieldErrors({ email: "An account with this email already exists." });
        return;
      }
      const body = (await response.json()) as {
        issues?: Partial<Record<FieldName, string[]>>;
      };
      if (body.issues) {
        setFieldErrors({
          orgName: body.issues.orgName?.[0],
          name: body.issues.name?.[0],
          email: body.issues.email?.[0],
          password: body.issues.password?.[0],
        });
        return;
      }
      setFormError("Something went wrong. Please try again.");
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <FormAlert tone="success">
          We sent a verification link to <strong>{sentTo}</strong>. Click it to
          unlock full access — until then you can log in with read-only access.
        </FormAlert>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Done verifying?{" "}
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

  return (
    <AuthCard title="Create your organization">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <Field
          label="Organization name"
          name="orgName"
          type="text"
          autoComplete="organization"
          required
          error={fieldErrors.orgName}
        />
        <Field
          label="Your name"
          name="name"
          type="text"
          autoComplete="name"
          required
          error={fieldErrors.name}
        />
        <Field
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={fieldErrors.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          error={fieldErrors.password}
        />
        <SubmitButton pending={pending}>Create organization</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
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
