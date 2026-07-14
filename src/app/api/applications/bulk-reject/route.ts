import { NextResponse } from "next/server";
import { bulkRejectApplications } from "@/lib/applications/queries";
import { requireUser } from "@/lib/auth/request";
import { bulkRejectSchema } from "@/lib/schemas";

// POST /api/applications/bulk-reject  (recruiter+ via proxy)
// Reason required exactly like single reject; target is explicit ids or a
// filter (the whole filtered set, server-side).
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bulkRejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation",
        issues: parsed.error.flatten().fieldErrors,
        message: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  const result = await bulkRejectApplications(user, parsed.data);
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
