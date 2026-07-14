import { NextResponse } from "next/server";
import {
  AlreadyApplied,
  createApplication,
} from "@/lib/applications/queries";
import { requireUser } from "@/lib/auth/request";
import { applicationCreateSchema } from "@/lib/schemas";

// POST /api/applications  (recruiter+; job/candidate org-verified server-side)
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = applicationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const application = await createApplication(user, parsed.data);
    if (!application) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    if (error instanceof AlreadyApplied) {
      return NextResponse.json({ error: "already_applied" }, { status: 409 });
    }
    throw error;
  }
}
