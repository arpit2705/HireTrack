import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import {
  CannotModifySelf,
  CannotRemoveLastAdmin,
  changeUserRole,
} from "@/lib/users/queries";
import { userRoleSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/users/:id  (admin) - role change; revokes the target's sessions
export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = userRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const updated = await changeUserRole(user, id, parsed.data.role);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof CannotModifySelf) {
      return NextResponse.json(
        { error: "cannot_modify_self" },
        { status: 400 },
      );
    }
    if (error instanceof CannotRemoveLastAdmin) {
      return NextResponse.json(
        { error: "cannot_remove_last_admin" },
        { status: 400 },
      );
    }
    throw error;
  }
}
