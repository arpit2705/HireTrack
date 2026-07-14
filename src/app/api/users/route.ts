import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import {
  DuplicateUserEmail,
  inviteUser,
  listOrgUsers,
} from "@/lib/users/queries";
import { userInviteSchema } from "@/lib/schemas";

// GET /api/users  (admin via proxy) - org user list
export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ items: await listOrgUsers(user.orgId) });
}

// POST /api/users  (admin) - invite: creates the user with no password and
// emails a set-password link (which also verifies the address)
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = userInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const invited = await inviteUser(user, parsed.data);
    return NextResponse.json(invited, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateUserEmail) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    throw error;
  }
}
