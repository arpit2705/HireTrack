import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import { updateOrg } from "@/lib/users/queries";
import { orgUpdateSchema } from "@/lib/schemas";

// PATCH /api/org  (admin) - rename the organization
export async function PATCH(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = orgUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  return NextResponse.json(await updateOrg(user, parsed.data));
}
