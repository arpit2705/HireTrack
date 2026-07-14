import { NextResponse } from "next/server";
import { softDeleteApplication } from "@/lib/applications/queries";
import { requireUser } from "@/lib/auth/request";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/applications/:id  (recruiter+; soft delete - the row keeps its
// history and is revived if the candidate re-applies)
export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const deleted = await softDeleteApplication(user, id);
  if (!deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
