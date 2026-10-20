import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";

/** 32 random bytes → 43-char base64url. Shown to the owner once; only the hash is stored. */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Pseudonymous rate-limit key: a keyed hash of the client IP. The IP itself is never stored or
 * logged. The key is SHARE_RATE_SALT if set, otherwise derived from the server-only service-role
 * key, so a deployment needs no extra secret. Rotating either only resets rate-limit buckets.
 */
export function clientKey(ip: string): string {
  const secret = process.env.SHARE_RATE_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("SHARE_RATE_SALT or SUPABASE_SERVICE_ROLE_KEY must be set");
  return createHmac("sha256", secret ?? "dev-only-salt").update(`rate-limit:${ip}`).digest("hex");
}

/** Player-facing link. The token sits in the URL fragment, which browsers never send to servers (DEC-38). */
export function shareUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/p#${token}`;
}
