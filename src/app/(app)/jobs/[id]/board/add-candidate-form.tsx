"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CandidateWire } from "@/lib/candidates/queries";

interface AddCandidateFormProps {
  pending: boolean;
  onAdd: (candidateId: string) => void;
}

// Search-and-pick from the org's candidates to add them to this job's board.
export function AddCandidateForm({ pending, onAdd }: AddCandidateFormProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");

  const { data } = useQuery({
    queryKey: ["candidate-picker", search],
    queryFn: async (): Promise<{ items: CandidateWire[] }> => {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("q", search);
      const response = await fetch(`/api/candidates?${params}`);
      if (!response.ok) throw new Error("candidates_fetch_failed");
      return response.json();
    },
  });

  const candidates = data?.items ?? [];

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (selected) {
          onAdd(selected);
          setSelected("");
        }
      }}
    >
      <div className="w-full max-w-56 space-y-2">
        <label htmlFor="candidate-search" className="text-sm font-medium">
          Add candidate
        </label>
        <Input
          id="candidate-search"
          type="search"
          placeholder="Search candidates…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="candidate-select" className="sr-only">
          Candidate
        </label>
        <select
          id="candidate-select"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="flex h-9 min-w-52 rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Pick a candidate…</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} ({candidate.email})
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" disabled={!selected || pending}>
        Add to board
      </Button>
    </form>
  );
}
