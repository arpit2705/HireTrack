"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Error boundary for the /jobs segment (list and detail).
export default function JobsError({
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
    <div
      role="alert"
      className="rounded-xl border border-dashed p-12 text-center"
    >
      <p className="text-lg font-medium">Couldn&apos;t load your jobs</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Your data is intact - this request failed on our side. Try again — if it keeps happening, sign
        out and back in.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
