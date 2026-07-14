import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import { signOutAllUsers } from "@/lib/users/queries";

// DELETE /api/org/sessions  (admin, danger zone) - signs out every user in
// the org except the acting admin, by deleting their session rows.
export async function DELETE() {
  const user = await requireUser();
  const revoked = await signOutAllUsers(user);
  return NextResponse.json({ ok: true, revoked });
}
