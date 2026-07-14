import { db } from "@/lib/db";
import type { RateLimitRecord, RateLimitStore } from "@/lib/auth/rate-limit";

// Production RateLimitStore on the rate_limit table. Postgres rather than
// process memory because Vercel serverless instances don't share state.
export const postgresRateLimitStore: RateLimitStore = {
  async get(key: string): Promise<RateLimitRecord | null> {
    const row = await db.rateLimit.findUnique({ where: { key } });
    if (!row) return null;
    return {
      attempts: row.attempts,
      windowStart: row.windowStart,
      lockedUntil: row.lockedUntil,
    };
  },

  async set(key: string, record: RateLimitRecord): Promise<void> {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, ...record },
      update: record,
    });
  },

  async delete(key: string): Promise<void> {
    await db.rateLimit.deleteMany({ where: { key } });
  },
};
