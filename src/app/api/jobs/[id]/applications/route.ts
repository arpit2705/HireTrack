import { NextResponse } from "next/server";
import { getJobBoard } from "@/lib/applications/queries";
import { requireUser } from "@/lib/auth/request";

type Params = { params: Promise<{ id: string }> };

// GET /api/jobs/:id/applications  (recruiter+, org-scoped via the job)
export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const board = await getJobBoard(user.orgId, id);
  if (!board) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(board);
}
