"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, Field, FormAlert, SubmitButton } from "@/components/form";
import { loginInputSchema } from "@/lib/schemas";

// Open-redirect guard: only same-app paths may be used as post-login target.
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"email" | "password", string>>
  >({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = loginInputSchema.safeParse(data);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: errors.email?.[0],
        password: errors.password?.[0],
      });
      return;
    }

    setPending(true);
    const result = await signIn("credentials", {
      redirect: false,
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (result?.error) {
      setPending(false);
      setFormError(
        result.code === "rate_limited"
          ? "Too many failed attempts. Try again in about 15 minutes."
          : "Invalid email or password.",
      );
      return;
    }

    // Full navigation so the middleware sees the fresh session cookie.
    window.location.assign(safeNext(searchParams.get("next")));
  }

  return (
    <AuthCard title="Log in to HireTrack">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <Field
          label="Email"
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
          autoComplete="current-password"
          required
          error={fieldErrors.password}
        />
        <SubmitButton pending={pending}>Log in</SubmitButton>
      </form>
      <div className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          <Link
            href="/forgot-password"
            className="rounded font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-400"
          >
            Forgot your password?
          </Link>
        </p>
        <p>
          New here?{" "}
          <Link
            href="/signup"
            className="rounded font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-400"
          >
            Create your organization
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}

// The fallback renders the full card shell server-side so first paint (and
// LCP) doesn't wait for hydration - Suspense(null) cost login ~3s of LCP.
function LoginShell() {
  return (
    <AuthCard title="Log in to HireTrack">
      <div aria-busy="true" className="space-y-4">
        <div className="h-11 w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-11 w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}
