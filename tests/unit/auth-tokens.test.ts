import { describe, expect, it } from "vitest";
import {
  EMAIL_TOKEN_TTL_MS,
  generateEmailToken,
  hashEmailToken,
} from "@/lib/auth/tokens";

describe("email verification tokens", () => {
  it("generates a raw token whose hash matches hashEmailToken(raw)", () => {
    const { raw, hash } = generateEmailToken();
    expect(hashEmailToken(raw)).toBe(hash);
  });

  it("never equals its own hash (only the hash is stored)", () => {
    const { raw, hash } = generateEmailToken();
    expect(raw).not.toBe(hash);
  });

  it("has at least 256 bits of entropy (43+ base64url chars)", () => {
    const { raw } = generateEmailToken();
    expect(raw.length).toBeGreaterThanOrEqual(43);
  });

  it("generates unique tokens", () => {
    const seen = new Set(
      Array.from({ length: 100 }, () => generateEmailToken().raw),
    );
    expect(seen.size).toBe(100);
  });

  it("hashing is deterministic", () => {
    expect(hashEmailToken("abc")).toBe(hashEmailToken("abc"));
  });

  it("ships a 24h TTL", () => {
    expect(EMAIL_TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
