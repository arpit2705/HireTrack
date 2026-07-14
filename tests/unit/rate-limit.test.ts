import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  MAX_LOCK_MS,
  WINDOW_MS,
  checkRateLimit,
  clearRateLimit,
  recordFailedAttempt,
  type RateLimitRecord,
  type RateLimitStore,
} from "@/lib/auth/rate-limit";

function memoryStore(): RateLimitStore {
  const map = new Map<string, RateLimitRecord>();
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, record) => void map.set(key, record),
    delete: async (key) => void map.delete(key),
  };
}

const t0 = new Date("2026-07-12T10:00:00.000Z");
const at = (ms: number) => new Date(t0.getTime() + ms);
const KEY = "login:203.0.113.7:ada@example.com";

describe("rate limiter (5 attempts / 15 min, exponential lockout)", () => {
  it("allows the first MAX_ATTEMPTS failures, blocks after", async () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect((await checkRateLimit(store, KEY, at(i))).allowed).toBe(true);
      await recordFailedAttempt(store, KEY, at(i));
    }
    const blocked = await checkRateLimit(store, KEY, at(MAX_ATTEMPTS));
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(WINDOW_MS);
    }
  });

  it("doubles the lockout on continued failures (exponential backoff)", async () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await recordFailedAttempt(store, KEY, t0);
    }
    const first = await store.get(KEY);
    expect(first?.lockedUntil?.getTime()).toBe(t0.getTime() + WINDOW_MS);

    await recordFailedAttempt(store, KEY, t0);
    const second = await store.get(KEY);
    expect(second?.lockedUntil?.getTime()).toBe(t0.getTime() + 2 * WINDOW_MS);
  });

  it("caps the lockout at MAX_LOCK_MS", async () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_ATTEMPTS + 20; i++) {
      await recordFailedAttempt(store, KEY, t0);
    }
    const record = await store.get(KEY);
    expect(record?.lockedUntil?.getTime()).toBe(t0.getTime() + MAX_LOCK_MS);
  });

  it("allows again after the lockout expires", async () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await recordFailedAttempt(store, KEY, t0);
    }
    expect((await checkRateLimit(store, KEY, at(WINDOW_MS - 1))).allowed).toBe(
      false,
    );
    expect((await checkRateLimit(store, KEY, at(WINDOW_MS + 1))).allowed).toBe(
      true,
    );
  });

  it("a successful login clears the counter", async () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await recordFailedAttempt(store, KEY, t0);
    }
    await clearRateLimit(store, KEY);
    expect((await checkRateLimit(store, KEY, at(1))).allowed).toBe(true);
  });

  it("expired windows start fresh instead of accumulating", async () => {
    const store = memoryStore();
    await recordFailedAttempt(store, KEY, t0);
    await recordFailedAttempt(store, KEY, at(WINDOW_MS + 1));
    const record = await store.get(KEY);
    expect(record?.attempts).toBe(1);
  });
});
