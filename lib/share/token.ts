import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes → 43-char base64url. Shown to the owner once; only the hash is stored. */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Pseudonymous rate-limit key: salted hash of the client IP. The IP itself is never stored or logged. */
export function clientKey(ip: string): string {
  const salt = process.env.SHARE_RATE_SALT;
  if (!salt && process.env.NODE_ENV === "production") throw new Error("SHARE_RATE_SALT must be set in production");
  return createHash("sha256").update(`${salt ?? "dev-only-salt"}:${ip}`).digest("hex");
}

/** Player-facing link. The token sits in the URL fragment, which browsers never send to servers (DEC-38). */
export function shareUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/p#${token}`;
}
