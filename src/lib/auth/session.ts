import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { SessionInfo } from "@/lib/auth/access";

export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Auth.js prefixes the cookie name with "__Secure-" based on the ACTUAL
// request protocol (https), not NODE_ENV - a local production server over
// http uses the plain name. Readers must accept both; writers must pick by
// the live protocol or the browser rejects the __Secure- prefix on http.
export const SESSION_COOKIE_SECURE = "__Secure-authjs.session-token";
export const SESSION_COOKIE_PLAIN = "authjs.session-token";

export function sessionCookieName(secure: boolean): string {
  return secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE_PLAIN;
}

export function readSessionToken(cookies: {
  get(name: string): { value: string } | undefined;
}): string | undefined {
  return (
    cookies.get(SESSION_COOKIE_SECURE)?.value ??
    cookies.get(SESSION_COOKIE_PLAIN)?.value
  );
}

// Resolve a session cookie to the middleware's SessionInfo. Expired sessions
// and deactivated users both read as "no session".
export async function getSessionInfo(
  sessionToken: string,
): Promise<SessionInfo | null> {
  const session = await db.session.findUnique({
    where: { sessionToken },
    include: { user: true },
  });
  if (!session || session.expires.getTime() <= Date.now()) return null;
  if (session.user.deactivatedAt) return null;

  return {
    userId: session.user.id,
    orgId: session.user.orgId,
    role: session.user.role,
    emailVerified: session.user.emailVerifiedAt !== null,
  };
}

// Session rotation (plan requirement: rotate on login and on every privilege
// change). Issues a new session ID for the same user and deletes the old row;
// the caller must set the returned token as the new session cookie.
export async function rotateSession(
  oldSessionToken: string,
): Promise<string | null> {
  const session = await db.session.findUnique({
    where: { sessionToken: oldSessionToken },
  });
  if (!session || session.expires.getTime() <= Date.now()) return null;

  const newToken = randomUUID();
  await db.$transaction([
    db.session.create({
      data: {
        sessionToken: newToken,
        userId: session.userId,
        expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
      },
    }),
    db.session.delete({ where: { id: session.id } }),
  ]);
  return newToken;
}

// Revoke sessions after privilege changes made by someone else (role change,
// deactivation): every other device/session for the user is logged out.
export async function revokeUserSessions(
  userId: string,
  exceptSessionToken?: string,
): Promise<number> {
  const result = await db.session.deleteMany({
    where: {
      userId,
      ...(exceptSessionToken
        ? { sessionToken: { not: exceptSessionToken } }
        : {}),
    },
  });
  return result.count;
}
