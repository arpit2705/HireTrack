import { NextResponse, type NextRequest } from "next/server";
import { getAnalytics } from "@/lib/analytics/queries";
import { requireUser } from "@/lib/auth/request";

// GET /api/analytics/funnel?jobId=  (admin org-wide, recruiter own jobs;
// hiring managers blocked at the proxy per the matrix)
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const jobId = request.nextUrl.searchParams.get("jobId") ?? undefined;

  const data = await getAnalytics(user, jobId);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
