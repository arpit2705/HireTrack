import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import {
  ApplicationNotSchedulable,
  InvalidInterviewer,
  listInterviews,
  scheduleInterview,
} from "@/lib/interviews/queries";
import { interviewCreateSchema } from "@/lib/schemas";

// GET /api/interviews  (all roles; HM sees own only, recruiter+ org-wide)
export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ items: await listInterviews(user) });
}

// POST /api/interviews  (recruiter+ via proxy; org-verified interviewer)
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = interviewCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const interview = await scheduleInterview(user, parsed.data);
    if (!interview) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(interview, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidInterviewer) {
      return NextResponse.json(
        { error: "invalid_interviewer" },
        { status: 400 },
      );
    }
    if (error instanceof ApplicationNotSchedulable) {
      return NextResponse.json(
        { error: "application_rejected" },
        { status: 409 },
      );
    }
    throw error;
  }
}
