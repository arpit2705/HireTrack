import type { ComponentPropsWithoutRef, ReactNode } from "react";

// Minimal accessible form primitives for auth screens and inline forms.
// Palette: porcelain background, ink-indigo text, coral focus rings, lavender surfaces.

const inputClass =
  "h-11 w-full rounded-xl border border-[#E3E1F5] bg-white px-3 text-base " +
  "text-[#14132B] placeholder:text-[#6B6A80]/60 outline-none " +
  "transition-all duration-150 ease-out " +
  "focus-visible:border-[#FF7A59] focus-visible:ring-3 focus-visible:ring-[#FF7A59]/20 focus-visible:bg-[#FFFAF8] " +
  "aria-[invalid=true]:border-[#EF4444] aria-[invalid=true]:ring-3 aria-[invalid=true]:ring-[#EF4444]/20";

interface FieldProps extends ComponentPropsWithoutRef<"input"> {
  label: string;
  name: string;
  error?: string;
}

export function Field({ label, name, error, ...props }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="space-y-2">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-[#14132B] font-jetbrains tracking-wide"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-[#B91C1C] font-jetbrains">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pending,
}: {
  children: ReactNode;
  pending: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        "h-11 w-full rounded-xl bg-primary px-4 text-base font-semibold text-white font-grotesk " +
        "shadow-primary-glow " +
        "transition-all duration-150 ease-out " +
        "hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-primary-glow-hover " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
        "active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none"
      }
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function FormAlert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? "border-[#FF7A59]/30 bg-[#FF7A59]/8 text-[#7A2010]"
      : "border-[#22C55E]/30 bg-[#22C55E]/8 text-[#14532D]";

  const icon =
    tone === "error" ? (
      // Exclamation circle
      <svg className="mt-0.5 size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    ) : (
      // Check circle
      <svg className="mt-0.5 size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
    );

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${toneClass}`}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E3E1F5] bg-white p-8 shadow-card">
        <h1 className="mb-6 font-grotesk text-2xl font-bold tracking-tight text-[#14132B]">
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}
