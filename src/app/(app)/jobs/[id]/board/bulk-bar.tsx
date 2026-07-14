"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PIPELINE_STAGES, type Stage } from "@/lib/schemas";

interface BulkBarProps {
  selectedCount: number;
  stageCounts: Record<Stage, number>;
  pending: boolean;
  onRejectSelected: (reason: string) => void;
  onRejectStage: (stage: Stage, reason: string) => void;
  onClearSelection: () => void;
}

// Bulk reject controls. Two targets: the checkbox selection (explicit ids)
// or an ENTIRE stage (server-side filter = select-all-across-pages). Both
// require a reason and an explicit confirm step before anything happens.
export function BulkBar({
  selectedCount,
  stageCounts,
  pending,
  onRejectSelected,
  onRejectStage,
  onClearSelection,
}: BulkBarProps) {
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const [confirming, setConfirming] = useState<null | "selected" | "stage">(
    null,
  );

  const selectionMode = selectedCount > 0;
  const reasonValid = reason.trim().length >= 2;
  const stageCount = stage ? stageCounts[stage] : 0;

  function reset() {
    setConfirming(null);
    setReason("");
    setStage("");
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-sm font-medium">
          {selectionMode
            ? `${selectedCount} selected`
            : "Bulk reject"}
        </p>
        {!selectionMode ? (
          <div className="space-y-1">
            <label htmlFor="bulk-stage" className="sr-only">
              Stage to reject
            </label>
            <select
              id="bulk-stage"
              value={stage}
              onChange={(event) => {
                setStage(event.target.value as Stage | "");
                setConfirming(null);
              }}
              className="flex h-9 min-w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">Entire stage…</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s} disabled={stageCounts[s] === 0}>
                  {s} ({stageCounts[s]})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="w-full max-w-xs space-y-1">
          <label htmlFor="bulk-reason" className="sr-only">
            Rejection reason (required)
          </label>
          <Input
            id="bulk-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setConfirming(null);
            }}
            placeholder="Rejection reason (required)"
            className="h-9"
          />
        </div>

        {confirming === null ? (
          <Button
            variant="destructive"
            disabled={
              pending || !reasonValid || (!selectionMode && !stage)
            }
            onClick={() =>
              setConfirming(selectionMode ? "selected" : "stage")
            }
          >
            {selectionMode
              ? `Reject ${selectedCount} selected…`
              : stage
                ? `Reject all in ${stage}…`
                : "Reject…"}
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5">
            <span className="text-sm font-medium">
              {confirming === "selected"
                ? `Reject ${selectedCount} candidate${selectedCount === 1 ? "" : "s"}?`
                : `Reject ALL ${stageCount} in ${stage}?`}
            </span>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (confirming === "selected") {
                  onRejectSelected(reason.trim());
                } else if (stage) {
                  onRejectStage(stage, reason.trim());
                }
                reset();
              }}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
          </div>
        )}

        {selectionMode ? (
          <Button variant="ghost" onClick={onClearSelection}>
            Clear selection
          </Button>
        ) : null}
      </div>
    </div>
  );
}
