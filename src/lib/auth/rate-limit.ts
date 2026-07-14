// Fixed-window rate limiting with exponential lockout for login/reset
// (plan.md section 11: ~5 attempts / 15 min per IP+account).
//
// Storage is behind RateLimitStore so the logic is unit-testable and the
// production store (Postgres via Prisma, in rate-limit-store.ts) stays a
// dumb key-value adapter. On Vercel serverless, memory does not survive
// between invocations - hence Postgres, not an in-process Map.

export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_LOCK_MS = 4 * 60 * 60 * 1000;

export interface RateLimitRecord {
  attempts: number;
  windowStart: Date;
  lockedUntil: Date | null;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | null>;
  set(key: string, record: RateLimitRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export function rateLimitKey(
  scope: "login" | "reset",
  ip: string,
  account: string,
): string {
  return `${scope}:${ip}:${account.toLowerCase()}`;
}

export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const record = await store.get(key);
  if (!record) return { allowed: true };

  if (record.lockedUntil && record.lockedUntil.getTime() > now.getTime()) {
    return {
      allowed: false,
      retryAfterMs: record.lockedUntil.getTime() - now.getTime(),
    };
  }

  const windowExpired =
    now.getTime() - record.windowStart.getTime() >= WINDOW_MS;
  if (windowExpired) return { allowed: true };

  if (record.attempts >= MAX_ATTEMPTS) {
    // Locked for the remainder of the window even if lockedUntil already lapsed.
    return {
      allowed: false,
      retryAfterMs:
        record.windowStart.getTime() + WINDOW_MS - now.getTime(),
    };
  }

  return { allowed: true };
}

export async function recordFailedAttempt(
  store: RateLimitStore,
  key: string,
  now: Date = new Date(),
): Promise<void> {
  const record = await store.get(key);

  const windowExpired =
    !record || now.getTime() - record.windowStart.getTime() >= WINDOW_MS;

  const attempts = windowExpired ? 1 : record.attempts + 1;
  const windowStart = windowExpired ? now : record.windowStart;

  // From the MAX_ATTEMPTS-th failure on, lock with doubling duration:
  // 15m, 30m, 60m ... capped at MAX_LOCK_MS.
  let lockedUntil: Date | null = null;
  if (attempts >= MAX_ATTEMPTS) {
    const lockMs = Math.min(
      WINDOW_MS * 2 ** (attempts - MAX_ATTEMPTS),
      MAX_LOCK_MS,
    );
    lockedUntil = new Date(now.getTime() + lockMs);
  }

  await store.set(key, { attempts, windowStart, lockedUntil });
}

export async function clearRateLimit(
  store: RateLimitStore,
  key: string,
): Promise<void> {
  await store.delete(key);
}
