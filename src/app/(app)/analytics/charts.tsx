"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FunnelStage } from "@/lib/analytics/funnel";

// Real charts over real data: these receive live query results from the
// server component - there is no mock/placeholder series anywhere.

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

export function FunnelChart({ data }: { data: FunnelStage[] }) {
  const rows = data.map((stage) => ({
    name: stage.stage,
    reached: stage.reached,
    rejectedHere: stage.rejectedHere,
    conversion:
      stage.conversionToNext === null
        ? null
        : Math.round(stage.conversionToNext * 100),
  }));

  return (
    <div className="h-72 w-full" role="img" aria-label="Pipeline funnel chart">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--card-foreground)",
              fontSize: 12,
            }}
            formatter={(value, key) => [
              String(value ?? 0),
              key === "reached" ? "Reached stage" : "Rejected at stage",
            ]}
          />
          <Bar dataKey="reached" radius={[6, 6, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.name} fill="var(--primary)" />
            ))}
          </Bar>
          <Bar dataKey="rejectedHere" radius={[6, 6, 0, 0]} fill="var(--destructive)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourcesChart({
  data,
}: {
  data: { source: string; count: number }[];
}) {
  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label="Candidate source breakdown chart"
    >
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="source"
            width={110}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--card-foreground)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="var(--primary)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
