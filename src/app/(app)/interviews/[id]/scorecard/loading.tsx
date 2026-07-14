import { Skeleton } from "@/components/ui/skeleton";

// Skeleton shaped like the scorecard form (header, rating row, select,
// notes area, submit) - not the interviews table it previously inherited.
export default function ScorecardLoading() {
  return (
    <div
      className="mx-auto max-w-xl space-y-6"
      aria-busy="true"
      aria-label="Loading scorecard"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-11 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-11 w-44" />
    </div>
  );
}
