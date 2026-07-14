import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import {
  InterviewCancelledError,
  NotYourInterview,
  ScorecardExists,
  submitScorecard,
} from "@/lib/interviews/queries";
import { scorecardCreateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

// POST /api/interviews/:id/scorecard
// Proxy allows hiring managers only (admins/recruiters are the matrix's
// deliberate negative); here it narrows to the ASSIGNED interviewer.
export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = scorecardCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const interview = await submitScorecard(user, id, parsed.data);
    if (!interview) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(interview, { status: 201 });
  } catch (error) {
    if (error instanceof NotYourInterview) {
      // Explicit 403 (same-org, wrong interviewer) - not a silent empty result.
      return NextResponse.json({ error: "not_your_interview" }, { status: 403 });
    }
    if (error instanceof ScorecardExists) {
      return NextResponse.json(
        { error: "scorecard_exists" },
        { status: 409 },
      );
    }
    if (error instanceof InterviewCancelledError) {
      return NextResponse.json(
        { error: "interview_cancelled" },
        { status: 409 },
      );
    }
    throw error;
  }
}
