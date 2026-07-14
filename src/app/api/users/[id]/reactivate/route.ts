import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import { CannotModifySelf, setUserActive } from "@/lib/users/queries";

type Params = { params: Promise<{ id: string }> };

// POST /api/users/:id/reactivate  (admin)
export async function POST(_request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const updated = await setUserActive(user, id, true);
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
    throw error;
  }
}
