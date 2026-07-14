import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitKey,
  recordFailedAttempt,
} from "@/lib/auth/rate-limit";
import { postgresRateLimitStore } from "@/lib/auth/rate-limit-store";
import { EMAIL_TOKEN_TTL_MS, generateEmailToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { resetRequestSchema } from "@/lib/schemas";

// Password reset request. Rate-limited per IP+account and always answers
// 200 for a valid-shaped request, so responses can't be used to enumerate
// which emails have accounts.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = resetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = rateLimitKey("reset", ip, email);

  const limit = await checkRateLimit(postgresRateLimitStore, key);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }
  // Every request consumes an attempt: reset is request-limited, not
  // failure-limited, or it would be a free account-enumeration oracle.
  await recordFailedAttempt(postgresRateLimitStore, key);

  const user = await db.user.findUnique({ where: { email } });
  if (user && !user.deactivatedAt) {
    const token = generateEmailToken();
    await db.emailToken.create({
      data: {
        userId: user.id,
        tokenHash: token.hash,
        purpose: "password_reset",
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    await sendPasswordResetEmail(email, token.raw);
  }

  return NextResponse.json({ ok: true });
}
