import { NextResponse } from "next/server";
import {
  ApplicationRejectedError,
  rejectApplication,
} from "@/lib/applications/queries";
import { requireUser } from "@/lib/auth/request";
import { rejectApplicationSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

// POST /api/applications/:id/reject  (recruiter+; reason required
// client-side AND here - plan.md section 10)
export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = rejectApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const application = await rejectApplication(user, id, parsed.data.reason);
    if (!application) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(application);
  } catch (error) {
    if (error instanceof ApplicationRejectedError) {
      return NextResponse.json(
        { error: "application_rejected" },
        { status: 409 },
      );
    }
    throw error;
  }
}
