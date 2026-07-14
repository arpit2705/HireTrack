import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/request";
import {
  DuplicateCandidateEmail,
  createCandidate,
  listCandidates,
} from "@/lib/candidates/queries";
import { candidateCreateSchema, parseCandidateListQuery } from "@/lib/schemas";

// GET /api/candidates?q=&tag=&sort=&cursor=&limit=  (recruiter+, org-scoped)
export async function GET(request: NextRequest) {
  const user = await requireUser();

  try {
    const query = parseCandidateListQuery(request.nextUrl.searchParams);
    return NextResponse.json(await listCandidates(user.orgId, query));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    throw error;
  }
}

// POST /api/candidates  (recruiter+, org from session only)
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = candidateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const candidate = await createCandidate(user, parsed.data);
    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateCandidateEmail) {
      // Org-level dedupe on email (plan.md section 3 indexes).
      return NextResponse.json({ error: "email_exists" }, { status: 409 });
    }
    throw error;
  }
}
