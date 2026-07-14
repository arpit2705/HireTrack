"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CancelInterviewButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function cancel() {
    setPending(true);
    try {
      await fetch(`/api/interviews/${interviewId}/cancel`, { method: "POST" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={cancel}>
      {pending ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
