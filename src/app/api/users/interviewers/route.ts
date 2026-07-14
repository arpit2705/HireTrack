import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import { db } from "@/lib/db";

// GET /api/users/interviewers  (recruiter+ via proxy)
// Active hiring managers in the caller's org - the assignable interviewer
// pool for scheduling. Deliberately narrow: id/name/email only.
export async function GET() {
  const user = await requireUser();

  const interviewers = await db.user.findMany({
    where: {
      orgId: user.orgId,
      role: "hiring_manager",
      deactivatedAt: null,
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items: interviewers });
}
