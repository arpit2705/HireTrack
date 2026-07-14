import { createHash, randomBytes } from "node:crypto";

// Email verification / password reset tokens. The raw token travels only in
// the email link; the database stores its SHA-256 hash (email_token table),
// so a DB leak cannot be replayed as a valid link.

export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashEmailToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateEmailToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashEmailToken(raw) };
}
