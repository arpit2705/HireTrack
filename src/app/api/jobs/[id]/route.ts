import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import {
  InvalidJobStatusChange,
  getJob,
  updateJob,
} from "@/lib/jobs/queries";
import { jobUpdateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

// Cross-org ids intentionally 404 (via the org-scoped query), never 403:
// a 403 would confirm the resource exists in someone else's org.

// GET /api/jobs/:id  (recruiter+, org-scoped)
export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const job = await getJob(user.orgId, id);
  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(job);
}

// PATCH /api/jobs/:id  (recruiter+, org-scoped; returns the updated record)
export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = jobUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const job = await updateJob(user, id, parsed.data);
    if (!job) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof InvalidJobStatusChange) {
      return NextResponse.json(
        { error: "invalid_status_change", message: error.message },
        { status: 409 },
      );
    }
    throw error;
  }
}
