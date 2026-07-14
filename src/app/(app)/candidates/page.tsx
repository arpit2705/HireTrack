import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, CandidatesIllustration } from "@/components/empty-state";
import { requireUser } from "@/lib/auth/request";
import { listCandidates } from "@/lib/candidates/queries";
import {
  parseCandidateListQuery,
  type CandidateListQuery,
} from "@/lib/schemas";

export const metadata: Metadata = { title: "Candidates" };

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });



function queryString(
  query: CandidateListQuery,
  overrides: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  const merged = {
    q: query.q,
    tag: query.tag,
    sort: query.sort === "created_desc" ? undefined : query.sort,
    ...overrides,
  };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }

  let query: CandidateListQuery;
  try {
    query = parseCandidateListQuery(params);
  } catch {
    redirect("/candidates");
  }

  const user = await requireUser();
  const { items, nextCursor } = await listCandidates(user.orgId, query);
  const hasFilters = Boolean(query.q || query.tag);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-3xl font-bold tracking-tight text-foreground">Candidates</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {items.length > 0
              ? `${items.length} candidate${items.length !== 1 ? "s" : ""} in pipeline`
              : "Your candidate pool lives here"}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/candidates/new">Add candidate</Link>
        </Button>
      </div>

      {/* Filter form */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs space-y-1.5">
          <label htmlFor="q" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Search
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Name or email…"
            defaultValue={query.q ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tag" className="font-jetbrains text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tag
          </label>
          <Input
            id="tag"
            name="tag"
            placeholder="e.g. backend"
            defaultValue={query.tag ?? ""}
            className="w-36"
          />
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/candidates">Clear</Link>
          </Button>
        ) : null}
      </form>

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState
          illustration={<CandidatesIllustration />}
          heading={hasFilters ? "No candidates match your filters" : "No candidates yet"}
          subtext={
            hasFilters
              ? "Try another search term or tag, or clear the filters."
              : "Add your first candidate manually or import one with a resume."
          }
          action={
            hasFilters ? (
              <Button asChild variant="secondary">
                <Link href="/candidates">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/candidates/new">Add your first candidate</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead className="text-right">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((candidate, i) => (
                <TableRow
                  key={candidate.id}
                  className="animate-row-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <TableCell>
                    <Link
                      href={`/candidates/${candidate.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors duration-150 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {candidate.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-jetbrains text-xs text-muted-foreground">
                    {candidate.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {candidate.tags.map((tag) => (
                        <Badge key={tag} variant="tag">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {candidate.resumeUrl ? (
                      <span className="inline-flex items-center gap-1 text-[#22C55E] text-xs font-jetbrains">
                        <svg className="size-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                          <path d="M10 3.5L4.5 9 2 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                        Yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-jetbrains text-xs text-muted-foreground">
                    {dateFormat.format(candidate.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button asChild variant="secondary">
                <Link href={`/candidates${queryString(query, { cursor: nextCursor })}`}>
                  Next page
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
