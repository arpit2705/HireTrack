"use client";

import { useEffect } from "react";

// Root error boundary (plan.md screen 11): catches anything a segment-level
// boundary didn't. Plain elements only - if the crash came from a shared
// component, this must not depend on it.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        HireTrack hit an unexpected error
      </h1>
      <p className="mt-3 max-w-md text-center text-base text-zinc-600 dark:text-zinc-400">
        Your data is safe — this was a display problem on our side. Try again;
        if it keeps happening, sign out and back in.
        {error.digest ? ` (Error reference: ${error.digest})` : ""}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 flex h-11 items-center rounded-lg bg-indigo-600 px-6 text-base font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Try again
      </button>
    </main>
  );
}
