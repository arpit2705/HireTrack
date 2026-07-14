import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing (Argon2id)", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("demo1234");
    expect(await verifyPassword(hash, "demo1234")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("demo1234");
    expect(await verifyPassword(hash, "demo12345")).toBe(false);
  });

  it("produces argon2id hashes", async () => {
    const hash = await hashPassword("demo1234");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("salts: same password, different hashes", async () => {
    const [a, b] = await Promise.all([
      hashPassword("demo1234"),
      hashPassword("demo1234"),
    ]);
    expect(a).not.toBe(b);
  });

  it("verify never throws on a malformed hash, it returns false", async () => {
    expect(await verifyPassword("not-a-hash", "demo1234")).toBe(false);
  });
});
