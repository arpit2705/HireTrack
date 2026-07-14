import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/request";
import { createJob, listJobs } from "@/lib/jobs/queries";
import { jobCreateSchema, parseJobListQuery } from "@/lib/schemas";

// GET /api/jobs?q=&status=&sort=&cursor=&limit=  (recruiter+, org-scoped)
export async function GET(request: NextRequest) {
  const user = await requireUser();

  try {
    const query = parseJobListQuery(request.nextUrl.searchParams);
    const result = await listJobs(user.orgId, query);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    throw error;
  }
}

// POST /api/jobs  (recruiter+, org from session only)
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = jobCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const job = await createJob(user, parsed.data);
  return NextResponse.json(job, { status: 201 });
}
