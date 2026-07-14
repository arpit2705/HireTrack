import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { iterateExportRows } from "@/lib/applications/queries";
import { requireUser } from "@/lib/auth/request";
import { toCsvRow } from "@/lib/csv";
import { db } from "@/lib/db";
import { exportQuerySchema } from "@/lib/schemas";

// GET /api/applications/export?jobId=&stage=  (recruiter+ via proxy)
// STREAMED CSV: rows are queried in cursor batches and enqueued as they
// arrive - the response never assembles the full export in memory, so a
// 10k+ row pipeline streams past gateway timeouts instead of buffering
// (plan.md section 10).
export async function GET(request: NextRequest) {
  const user = await requireUser();

  const parsed = exportQuerySchema.safeParse({
    jobId: request.nextUrl.searchParams.get("jobId") ?? undefined,
    stage: request.nextUrl.searchParams.get("stage") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const query = parsed.data;

  await db.activityLog.create({
    data: {
      orgId: user.orgId,
      actorId: user.userId,
      entityType: query.jobId ? "job" : "organization",
      entityId: query.jobId ?? user.orgId,
      action: "csv_exported",
      metadata: { stage: query.stage ?? null },
    },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            toCsvRow([
              "candidate_name",
              "candidate_email",
              "job_title",
              "stage",
              "stage_updated_at",
              "rejected_at",
              "rejected_reason",
              "applied_at",
            ]),
          ),
        );
        for await (const batch of iterateExportRows(user.orgId, query)) {
          let chunk = "";
          for (const row of batch) {
            chunk += toCsvRow([
              row.candidateName,
              row.candidateEmail,
              row.jobTitle,
              row.stage,
              row.stageUpdatedAt.toISOString(),
              row.rejectedAt?.toISOString() ?? null,
              row.rejectedReason,
              row.createdAt.toISOString(),
            ]);
          }
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hiretrack-pipeline-export.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
