import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getAnalytics } from "@/lib/analytics/queries";
import { requireUser } from "@/lib/auth/request";
import { EmptyState, AnalyticsIllustration } from "@/components/empty-state";
import { FunnelChart, SourcesChart } from "./charts";

export const metadata: Metadata = { title: "Analytics" };

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5 transition-all duration-150 hover:-translate-y-0.5",
        accent
          ? "border-[#4F46E5]/20 bg-gradient-to-br from-[#4F46E5]/8 to-[#E8E6FF]/60 shadow-card"
          : "border-[#E3E1F5] bg-white shadow-card hover:shadow-card-hover",
      ].join(" ")}
    >
      <p className="font-jetbrains text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-grotesk text-4xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 font-jetbrains text-xs text-muted-foreground leading-relaxed">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const days = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}d`;

export default async function AnalyticsPage() {
  const user = await requireUser();
  const data = await getAnalytics(user);
  if (!data) return null; // unreachable without jobId, keeps types honest

  const empty = data.applications === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-grotesk text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {data.scope === "org"
            ? "Organization-wide, all jobs."
            : "Scoped to jobs you created."}
        </p>
      </div>

      {empty ? (
        <EmptyState
          illustration={<AnalyticsIllustration />}
          heading="No pipeline data yet"
          subtext="Analytics appear once candidates start moving through a pipeline. Create a job and add candidates to its board."
          action={
            <Button asChild>
              <Link href="/jobs">Go to jobs</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Open requisitions"
              value={String(data.jobs.open)}
              hint={`${data.jobs.total} total jobs`}
              accent
            />
            <StatCard label="Applications" value={String(data.applications)} />
            <StatCard label="Hires" value={String(data.hires)} />
            <StatCard
              label="Avg time to hire"
              value={days(data.timeToHire.avgDaysExcludingReverted)}
              hint={`${days(data.timeToHire.avgDaysNaive)} naive (incl. reverted time)`}
            />
          </div>

          {/* Funnel chart */}
          <section className="rounded-2xl border border-[#E3E1F5] bg-white p-6 shadow-card">
            <h2 className="font-grotesk text-lg font-semibold text-foreground">
              Funnel conversion by stage
            </h2>
            <p className="mt-1 font-jetbrains text-xs text-muted-foreground">
              Reached counts include candidates later rejected at that stage
              (stage-at-rejection is preserved), so conversion rates reflect
              real drop-off.
            </p>
            <div className="mt-5">
              <FunnelChart data={data.funnel} />
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-jetbrains text-xs text-muted-foreground">
              {data.funnel
                .filter((stage) => stage.conversionToNext !== null)
                .map((stage) => (
                  <div key={stage.stage}>
                    <dt className="inline">{stage.stage} → </dt>
                    <dd className="inline font-semibold text-foreground">
                      {Math.round((stage.conversionToNext ?? 0) * 100)}%
                    </dd>
                  </div>
                ))}
            </dl>
          </section>

          {/* Sources chart */}
          <section className="rounded-2xl border border-[#E3E1F5] bg-white p-6 shadow-card">
            <h2 className="font-grotesk text-lg font-semibold text-foreground">
              Candidate sources
            </h2>
            <div className="mt-5">
              <SourcesChart data={data.sources} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
