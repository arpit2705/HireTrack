import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { revokeUserSessions } from "@/lib/auth/session";
import { hashEmailToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { resetConfirmSchema } from "@/lib/schemas";

// Completes a password reset. Single-use token; all existing sessions are
// revoked (credential change = privilege change), so every device must log
// in again with the new password.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = resetConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const record = await db.emailToken.findUnique({
    where: { tokenHash: hashEmailToken(parsed.data.token) },
    include: { user: true },
  });
  if (!record || record.purpose !== "password_reset" || record.usedAt) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "expired_token" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db.$transaction([
    db.emailToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    db.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        // Completing an emailed token proves ownership of the address, so
        // invited users (created unverified, no password) become verified.
        emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(),
      },
    }),
    db.activityLog.create({
      data: {
        orgId: record.user.orgId,
        actorId: record.userId,
        entityType: "user",
        entityId: record.userId,
        action: "updated",
        metadata: { field: "password_reset" },
      },
    }),
  ]);
  await revokeUserSessions(record.userId);

  return NextResponse.json({ ok: true });
}
