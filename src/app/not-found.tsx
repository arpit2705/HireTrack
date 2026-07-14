import Link from "next/link";

// Root 404 (plan.md screen 11). Also what cross-org ids resolve to via
// notFound() - deliberately generic, no hints about what exists.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
        404
      </p>
      <h1 className="mt-4 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-center text-base text-zinc-600 dark:text-zinc-400">
        The link may be outdated, or the item may have been removed. Check the
        address, or head back to your pipeline.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/jobs"
          className="flex h-11 items-center rounded-lg bg-indigo-600 px-6 text-base font-medium text-white motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Go to jobs
        </Link>
        <Link
          href="/"
          className="flex h-11 items-center rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-700 motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
