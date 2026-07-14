import { Skeleton } from "@/components/ui/skeleton";

// Matches the CURRENT job detail layout: header, full-width pipeline board
// (5 columns), then the centered editor - reshaped in the milestone-10
// sweep after the milestone-5 board made the old single-column version stale.
export default function JobDetailLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading job">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Skeleton className="h-16 w-96 max-w-full" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  );
}
