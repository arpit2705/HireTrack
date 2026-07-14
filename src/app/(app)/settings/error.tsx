"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SettingsError({
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
      <p className="text-lg font-medium">Couldn&apos;t load settings</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Your organization data is intact — this request failed on our side.
        Try again; if it keeps happening, sign out and back in.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
