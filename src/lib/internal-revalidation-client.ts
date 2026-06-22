import "server-only"

import { getConfiguredSiteOrigin } from "@/lib/site-origin-config"

type InternalRevalidationPayload =
  | { type: "check-in"; userId: number }
  | { type: "approved-post"; postId: string; postSlug: string; boardSlug?: string | null; authorId: number }
  | { type: "approved-comment"; postId: string; postSlug?: string | null; boardSlug?: string | null; authorId: number }

function getInternalSecret() {
  return process.env.INTERNAL_REVALIDATION_SECRET?.trim()
    || process.env.SESSION_SECRET?.trim()
    || ""
}

function getInternalRevalidationOrigin() {
  const internalOrigin = process.env.INTERNAL_REVALIDATION_ORIGIN?.trim()
  if (internalOrigin) {
    return internalOrigin.replace(/\/$/, "")
  }

  return getConfiguredSiteOrigin()
}

export async function requestInternalContentRevalidation(payload: InternalRevalidationPayload) {
  const origin = getInternalRevalidationOrigin()
  const secret = getInternalSecret()

  if (!origin) {
    throw new Error("INTERNAL_REVALIDATION_ORIGIN / SITE_URL / APP_URL is not configured")
  }

  if (!secret) {
    throw new Error("INTERNAL_REVALIDATION_SECRET / SESSION_SECRET is not configured")
  }

  const response = await fetch(new URL("/api/internal/revalidate-content", `${origin}/`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-revalidation-secret": secret,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => "")
    const message = responseText.trim().slice(0, 240)
    throw new Error(`Internal content revalidation failed with HTTP ${response.status}${message ? `: ${message}` : ""}`)
  }

  return response.ok
}
