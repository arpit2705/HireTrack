"use client";

import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormAlert } from "@/components/form";
import { validTargetsFor } from "@/lib/applications/stage-moves";
import { PIPELINE_STAGES, type Stage } from "@/lib/schemas";
import { AddCandidateForm } from "./add-candidate-form";
import { BoardCard } from "./board-card";
import { BulkBar } from "./bulk-bar";

// Wire shape of BoardApplication after JSON serialization.
interface WireApplication {
  id: string;
  jobId: string;
  stage: Stage;
  stageUpdatedAt: string;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  candidate: { id: string; name: string; email: string };
}

interface BoardData {
  active: WireApplication[];
  rejected: WireApplication[];
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  // keepalive: board mutations (moves, rejects, bulk) fire right before
  // navigations - the e2e proved an in-flight PATCH gets aborted by unload
  // without it. Bodies here are tiny, well under the 64KB keepalive cap.
  const response = await fetch(url, { keepalive: true, ...init });
  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      code = ((await response.json()) as { error?: string }).error ?? code;
    } catch {
      // keep fallback code
    }
    throw new ApiError(response.status, code);
  }
  return response.json() as Promise<T>;
}

function noticeFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired — the change was not saved. Log in again.";
    }
    if (error.code === "invalid_stage_move") {
      return "That move isn't allowed: candidates go forward, or back one stage.";
    }
    if (error.code === "already_applied") {
      return "That candidate is already on this board.";
    }
    if (error.code === "email_not_verified") {
      return "Verify your email before changing the pipeline.";
    }
    if (error.status === 409) {
      return "That change conflicted with the current state — the board has been refreshed.";
    }
  }
  return "Something went wrong — the board has been refreshed.";
}

const STAGE_LABELS: Record<Stage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};

function StageColumn({
  stage,
  count,
  children,
}: {
  stage: Stage;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAGE_LABELS[stage]} column, ${count} candidates`}
      className={`flex min-h-64 flex-col rounded-xl border bg-muted/30 p-2 motion-safe:transition-colors motion-safe:duration-150 ${
        isOver ? "border-ring bg-primary/5" : ""
      }`}
    >
      <h3 className="flex items-center justify-between px-2 py-1 text-sm font-medium">
        {STAGE_LABELS[stage]}
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">
          {count}
        </span>
      </h3>
      {children}
    </section>
  );
}

export function KanbanBoard({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["board", jobId];
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const board = useQuery({
    queryKey,
    queryFn: () => api<BoardData>(`/api/jobs/${jobId}/applications`),
  });

  const move = useMutation({
    mutationFn: ({ id, to }: { id: string; to: Stage }) =>
      api<WireApplication>(`/api/applications/${id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: to }),
      }),
    onMutate: async ({ id, to }) => {
      setNotice(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BoardData>(queryKey);
      queryClient.setQueryData<BoardData>(queryKey, (old) =>
        old
          ? {
              ...old,
              active: old.active.map((app) =>
                app.id === id
                  ? { ...app, stage: to, stageUpdatedAt: new Date().toISOString() }
                  : app,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      // Snap the card back, then say why (plan.md section 10).
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setNotice(noticeFor(error));
    },
    // Refetch the authoritative board either way: this is what reconciles a
    // concurrent move by someone else (last write wins on the row).
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<WireApplication>(`/api/applications/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
    onMutate: () => setNotice(null),
    onError: (error) => setNotice(noticeFor(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkReject = useMutation({
    mutationFn: (body: {
      reason: string;
      applicationIds?: string[];
      filter?: { jobId: string; stage: Stage };
    }) =>
      api<{ rejected: number }>("/api/applications/bulk-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onMutate: () => setNotice(null),
    onSuccess: (result) => {
      setSelectedIds(new Set());
      setNotice(null);
      if (result.rejected === 0) {
        setNotice("Nothing matched - the board may have changed; refreshed.");
      }
    },
    onError: (error) => setNotice(noticeFor(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const unreject = useMutation({
    mutationFn: (id: string) =>
      api<WireApplication>(`/api/applications/${id}/unreject`, {
        method: "POST",
      }),
    onMutate: () => setNotice(null),
    onError: (error) => setNotice(noticeFor(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const add = useMutation({
    mutationFn: (candidateId: string) =>
      api<WireApplication>("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, candidateId }),
      }),
    onMutate: () => setNotice(null),
    onError: (error) => setNotice(noticeFor(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const to = over.id as Stage;
    const app = board.data?.active.find((a) => a.id === active.id);
    if (!app || app.stage === to) return;
    if (!validTargetsFor(app.stage).includes(to)) {
      setNotice(
        "That move isn't allowed: candidates go forward, or back one stage.",
      );
      return;
    }
    move.mutate({ id: app.id, to });
  }

  // Loading state: columns skeleton matching the final layout.
  if (board.isPending) {
    return (
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        aria-busy="true"
        aria-label="Loading pipeline board"
      >
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="space-y-2 rounded-xl border p-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // Error state.
  if (board.isError) {
    return (
      <div role="alert" className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">Couldn&apos;t load the pipeline board</p>
        <Button className="mt-4" onClick={() => board.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { active, rejected } = board.data;
  const pending =
    move.isPending ||
    reject.isPending ||
    add.isPending ||
    bulkReject.isPending ||
    unreject.isPending;

  const stageCounts = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [
      stage,
      active.filter((app) => app.stage === stage).length,
    ]),
  ) as Record<Stage, number>;

  function toggleSelect(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AddCandidateForm pending={pending} onAdd={(id) => add.mutate(id)} />
        <Button asChild variant="secondary">
          {/* Server-streamed CSV of this job's full pipeline */}
          <a href={`/api/applications/export?jobId=${jobId}`}>Export CSV</a>
        </Button>
      </div>

      <BulkBar
        selectedCount={selectedIds.size}
        stageCounts={stageCounts}
        pending={pending}
        onRejectSelected={(reason) =>
          bulkReject.mutate({ reason, applicationIds: [...selectedIds] })
        }
        onRejectStage={(stage, reason) =>
          bulkReject.mutate({ reason, filter: { jobId, stage } })
        }
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {notice ? <FormAlert tone="error">{notice}</FormAlert> : null}

      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No candidates in this pipeline yet — search above and add the first
          one.
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PIPELINE_STAGES.map((stage) => {
            const items = active.filter((app) => app.stage === stage);
            return (
              <StageColumn key={stage} stage={stage} count={items.length}>
                <ul className="flex flex-1 flex-col gap-2 p-1">
                  {items.map((app) => (
                    <BoardCard
                      key={app.id}
                      application={app}
                      pending={pending}
                      selected={selectedIds.has(app.id)}
                      onToggleSelect={toggleSelect}
                      onMove={(id, to) => move.mutate({ id, to })}
                      onReject={(id, reason) => reject.mutate({ id, reason })}
                    />
                  ))}
                </ul>
              </StageColumn>
            );
          })}
        </div>
      </DndContext>

      {rejected.length > 0 ? (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Rejected ({rejected.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {rejected.map((app) => (
              <li
                key={app.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  <span className="font-medium">{app.candidate.name}</span>{" "}
                  <span className="text-muted-foreground">
                    — rejected from {STAGE_LABELS[app.stage]}:{" "}
                    {app.rejectedReason}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => unreject.mutate(app.id)}
                >
                  Reinstate
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
