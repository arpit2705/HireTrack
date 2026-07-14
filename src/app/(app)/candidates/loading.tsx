import { Skeleton } from "@/components/ui/skeleton";

export default function CandidatesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading candidates">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-16 w-full max-w-xs" />
        <Skeleton className="h-16 w-36" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="space-y-0 overflow-hidden rounded-xl border">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-t p-3">
            <Skeleton className="h-6 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
