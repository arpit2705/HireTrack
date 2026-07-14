"use client";

import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validTargetsFor } from "@/lib/applications/stage-moves";
import type { Stage } from "@/lib/schemas";

// Wire shape (JSON dates are strings); only the fields the card renders.
interface CardApplication {
  id: string;
  stage: Stage;
  stageUpdatedAt: string | Date;
  candidate: { id: string; name: string; email: string };
}

interface BoardCardProps {
  application: CardApplication;
  pending: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onMove: (id: string, to: Stage) => void;
  onReject: (id: string, reason: string) => void;
}

function daysInStage(since: string | Date): string {
  const days = Math.floor(
    (Date.now() - new Date(since).getTime()) / 86_400_000,
  );
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

export function BoardCard({
  application,
  pending,
  selected,
  onToggleSelect,
  onMove,
  onReject,
}: BoardCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: application.id, disabled: pending || rejecting });

  const validTargets = validTargetsFor(application.stage);

  return (
    <li
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={`relative rounded-lg border bg-card p-3 shadow-xs ${
        isDragging ? "z-10 opacity-80 shadow-md" : ""
      } ${selected ? "border-primary ring-1 ring-primary/40" : ""} motion-safe:transition-shadow motion-safe:duration-150`}
    >
      <label className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center">
        <span className="sr-only">
          Select {application.candidate.name} for bulk actions
        </span>
        <input
          type="checkbox"
          checked={selected}
          disabled={pending}
          onChange={() => onToggleSelect(application.id)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
      </label>
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab rounded outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`${application.candidate.name}, ${application.stage}, drag or use the move menu`}
      >
        <p className="text-sm font-medium">{application.candidate.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {application.candidate.email}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          In stage {daysInStage(application.stageUpdatedAt)}
        </p>
      </div>

      {rejecting ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length >= 2) {
              onReject(application.id, reason.trim());
              setRejecting(false);
              setReason("");
            }
          }}
        >
          <label htmlFor={`reason-${application.id}`} className="sr-only">
            Rejection reason
          </label>
          <Input
            id={`reason-${application.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (required)"
            autoFocus
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={reason.trim().length < 2}
              className="h-7 text-xs"
            >
              Confirm reject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setRejecting(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          {/* Keyboard-accessible alternative to dragging */}
          <label htmlFor={`move-${application.id}`} className="sr-only">
            Move {application.candidate.name} to stage
          </label>
          <select
            id={`move-${application.id}`}
            value=""
            disabled={pending}
            onChange={(event) => {
              if (event.target.value) {
                onMove(application.id, event.target.value as Stage);
              }
            }}
            className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Move to…</option>
            {validTargets.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}
