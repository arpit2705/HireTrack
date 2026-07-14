import { type NextRequest, NextResponse } from "next/server";
import { hashEmailToken } from "@/lib/auth/tokens";
import {
  SESSION_MAX_AGE_MS,
  readSessionToken,
  rotateSession,
  sessionCookieName,
} from "@/lib/auth/session";
import { db } from "@/lib/db";

// Landing endpoint for the emailed verification link. Always redirects to the
// /verify-email page with a status; never renders JSON at a link the user
// clicks. Verifying unlocks write access (a privilege change), so any live
// session in this browser is rotated.
export async function GET(request: NextRequest) {
  const toStatus = (status: "success" | "invalid" | "expired") =>
    NextResponse.redirect(
      new URL(`/verify-email?status=${status}`, request.url),
    );

  const raw = request.nextUrl.searchParams.get("token");
  if (!raw) return toStatus("invalid");

  const record = await db.emailToken.findUnique({
    where: { tokenHash: hashEmailToken(raw) },
    include: { user: true },
  });
  if (!record || record.purpose !== "verify_email" || record.usedAt) {
    return toStatus("invalid");
  }
  if (record.expiresAt.getTime() < Date.now()) return toStatus("expired");

  await db.$transaction([
    db.emailToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    db.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
    }),
    db.activityLog.create({
      data: {
        orgId: record.user.orgId,
        actorId: record.userId,
        entityType: "user",
        entityId: record.userId,
        action: "updated",
        metadata: { field: "email_verified" },
      },
    }),
  ]);

  const response = toStatus("success");
  const currentToken = readSessionToken(request.cookies);
  if (currentToken) {
    const rotated = await rotateSession(currentToken);
    if (rotated) {
      // Name and Secure flag follow the LIVE protocol - __Secure- cookies
      // are rejected by browsers over plain http.
      const secure = request.nextUrl.protocol === "https:";
      response.cookies.set(sessionCookieName(secure), rotated, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: SESSION_MAX_AGE_MS / 1000,
      });
    }
  }
  return response;
}
