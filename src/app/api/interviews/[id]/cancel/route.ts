import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import {
  InterviewNotCancellable,
  cancelInterview,
} from "@/lib/interviews/queries";

type Params = { params: Promise<{ id: string }> };

// POST /api/interviews/:id/cancel  (recruiter+ via proxy, org-scoped)
export async function POST(_request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const interview = await cancelInterview(user, id);
    if (!interview) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(interview);
  } catch (error) {
    if (error instanceof InterviewNotCancellable) {
      return NextResponse.json(
        { error: "not_cancellable" },
        { status: 409 },
      );
    }
    throw error;
  }
}
