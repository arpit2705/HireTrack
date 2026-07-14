import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import {
  DuplicateCandidateEmail,
  getCandidate,
  serializeCandidate,
  updateCandidate,
} from "@/lib/candidates/queries";
import { hasAssignedInterview } from "@/lib/interviews/queries";
import { candidateUpdateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

// GET /api/candidates/:id  (org-scoped; cross-org -> 404)
// Hiring managers get row-level access ONLY via an assigned interview -
// otherwise an explicit 403, never a silent empty result (plan.md sec. 10).
export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const candidate = await getCandidate(user.orgId, id);
  if (!candidate) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (
    user.role === "hiring_manager" &&
    !(await hasAssignedInterview(user.userId, candidate.id))
  ) {
    return NextResponse.json({ error: "not_assigned" }, { status: 403 });
  }
  return NextResponse.json(serializeCandidate(candidate));
}

// PATCH /api/candidates/:id  (recruiter+, org-scoped; returns updated record)
export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = candidateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const candidate = await updateCandidate(user, id, parsed.data);
    if (!candidate) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(candidate);
  } catch (error) {
    if (error instanceof DuplicateCandidateEmail) {
      return NextResponse.json({ error: "email_exists" }, { status: 409 });
    }
    throw error;
  }
}
