import { randomUUID } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import { encode as defaultEncode } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import {
  checkRateLimit,
  clearRateLimit,
  rateLimitKey,
  recordFailedAttempt,
} from "@/lib/auth/rate-limit";
import { postgresRateLimitStore } from "@/lib/auth/rate-limit-store";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_MAX_AGE_MS } from "@/lib/auth/session";
import { db } from "@/lib/db";

// Auth.js with the DATABASE session strategy (session table, not JWTs), so
// sessions can be rotated on login/privilege change and revoked server-side.
//
// Credentials + database sessions needs the jwt.encode override below:
// Auth.js only creates session rows for OAuth sign-ins on its own, so for
// credentials logins we create the row ourselves and return its token as the
// cookie value. A NEW session row per login = rotation on login.

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}
class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// Auth.js refuses strategy "database" when credentials is the ONLY provider
// (UnsupportedStrategy). Google is part of the locked stack, so it is always
// registered; without real keys the sign-in button stays hidden (hasGoogle)
// and the provider is inert placeholder config.
export const hasGoogle = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) throw new InvalidCredentials();

        const key = rateLimitKey("login", requestIp(request), email);
        const limit = await checkRateLimit(postgresRateLimitStore, key);
        if (!limit.allowed) throw new RateLimited();

        const user = await db.user.findUnique({ where: { email } });
        // Verify even when user is null-ish in outcome: same failure path for
        // wrong email and wrong password, and the same rate-limit cost.
        const valid = user?.passwordHash
          ? await verifyPassword(user.passwordHash, password)
          : false;

        if (!user || !valid || user.deactivatedAt) {
          await recordFailedAttempt(postgresRateLimitStore, key);
          throw new InvalidCredentials();
        }

        await clearRateLimit(postgresRateLimitStore, key);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "unset-see-env-example",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "unset-see-env-example",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // Google may only log into EXISTING users: accounts are created via
        // signup (org owner) or invitation, never implicitly by OAuth.
        const existing = user.email
          ? await db.user.findUnique({ where: { email: user.email } })
          : null;
        return Boolean(existing && !existing.deactivatedAt);
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider === "credentials") token.credentials = true;
      return token;
    },
    async session({ session, user }) {
      // Construct the response EXPLICITLY. With the database strategy the
      // incoming object carries the raw adapter rows; returning or mutating
      // it would leak passwordHash and sessionToken to the client.
      return {
        expires: session.expires,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          orgId: user.orgId,
          emailVerifiedAt: user.emailVerifiedAt,
        },
      };
    },
  },
  jwt: {
    async encode(params) {
      if (params.token?.credentials) {
        if (!params.token.sub) throw new Error("Missing user id on token");
        const sessionToken = randomUUID();
        await db.session.create({
          data: {
            sessionToken,
            userId: params.token.sub,
            expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
          },
        });
        return sessionToken;
      }
      return defaultEncode(params);
    },
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
});
