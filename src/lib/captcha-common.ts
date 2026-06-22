import crypto from "node:crypto"

import { PublicRouteError } from "@/lib/public-route-error"
import { createRedisKey } from "@/lib/redis"
import { acquireRedisLease } from "@/lib/redis-lease"

/**
 * Shared primitives for HMAC-based one-time captcha tokens (see `pow-captcha.ts`
 * and `builtin-captcha.ts`). Keeping the HMAC + consume + timing-safe-equal
 * helpers in one place reduces drift and makes it easier to reason about the
 * security-critical paths.
 */

export interface ResolveCaptchaSecretOptions {
  /** Primary env var name. */
  primaryEnv: string
  /** Optional fallback env var name (e.g. `CAPTCHA_SECRET_KEY`). */
  fallbackEnv?: string
  /** Error message thrown when neither env var is configured. */
  missingMessage: string
}

/**
 * Reads and returns a captcha secret from the given env vars, throwing a plain
 * `Error` (not `PublicRouteError`) when unset — this is a server misconfiguration,
 * not a client error.
 */
export function resolveCaptchaSecret(options: ResolveCaptchaSecretOptions): string {
  const primary = process.env[options.primaryEnv]?.trim()
  if (primary) {
    return primary
  }

  if (options.fallbackEnv) {
    const fallback = process.env[options.fallbackEnv]?.trim()
    if (fallback) {
      return fallback
    }
  }

  throw new Error(options.missingMessage)
}

/**
 * HMAC-SHA256 signs `payload` with `secret` and returns the digest in the
 * requested encoding. `base64url` is preferred for URL-safe tokens; `hex` is
 * kept for pre-existing wire formats that must remain backward compatible.
 */
export function hmacSign(secret: string, payload: string, encoding: "hex" | "base64url"): string {
  return crypto.createHmac("sha256", secret).update(payload).digest(encoding)
}

/**
 * Constant-time string comparison. Short-circuits on length mismatch (which is
 * not itself secret for our use cases) and otherwise uses
 * `crypto.timingSafeEqual`.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  if (left.length !== right.length) {
    return false
  }
  return crypto.timingSafeEqual(left, right)
}

export function base64UrlEncodeUtf8(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url")
}

export function base64UrlDecodeUtf8(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8")
}

export interface ConsumeOneTimeCaptchaTokenOptions {
  /** Key scope segment, e.g. `"pow-captcha-consume"`. */
  scope: string
  /** Additional key segments that uniquely identify the token within the scope. */
  keyParts: Array<string>
  /** Absolute expiry timestamp in ms since epoch. */
  expiresAt: number
  /** Error message thrown when the token has already been consumed. */
  conflictMessage: string
}

/**
 * Acquires a single-use Redis lease keyed by `<scope>:<...keyParts>`. The
 * lease's TTL is derived from `expiresAt - now` (min 1 ms) so the dedup record
 * naturally expires alongside the token itself. Throws `PublicRouteError` on
 * collision.
 */
export async function consumeOneTimeCaptchaToken(options: ConsumeOneTimeCaptchaTokenOptions): Promise<void> {
  const lease = await acquireRedisLease({
    key: createRedisKey(options.scope, ...options.keyParts),
    ttlMs: Math.max(1, options.expiresAt - Date.now()),
  })

  if (!lease) {
    throw new PublicRouteError(options.conflictMessage)
  }
}