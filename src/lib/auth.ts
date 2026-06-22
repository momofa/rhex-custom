import { cache } from "react"

import { findSessionActorByUsername, type SessionActor } from "@/db/session-actor-queries"
import { getRequestIp, getRequestIpFromHeaders } from "@/lib/request-ip"
import { getSessionCookieName, parseSessionToken, readSessionTokenFromCookieHeader } from "@/lib/session"

export type { SessionActor } from "@/db/session-actor-queries"

async function resolveSessionActor(token: string | undefined, requestIp?: string | null): Promise<SessionActor | null> {
  const session = await parseSessionToken(token, { requestIp })

  if (!session) {
    return null
  }

  try {
    const actor = await findSessionActorByUsername(session.username)

    if (!actor) {
      return null
    }

    const invalidBeforeSeconds = actor.sessionInvalidBefore
      ? Math.floor(actor.sessionInvalidBefore.getTime() / 1000)
      : 0

    if (invalidBeforeSeconds > 0 && session.issuedAt <= invalidBeforeSeconds) {
      return null
    }

    return actor
  } catch (error) {
    console.error(error)
    return null
  }
}

export const getCurrentSessionActor = cache(async (): Promise<SessionActor | null> => {
  const { cookies, headers } = await import("next/headers")
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  return resolveSessionActor(
    cookieStore.get(getSessionCookieName())?.value,
    getRequestIpFromHeaders(headerStore),
  )
})

export async function getSessionActorFromRequest(request?: Pick<Request, "headers"> | null) {
  if (!request) {
    return null
  }

  return resolveSessionActor(
    readSessionTokenFromCookieHeader(request.headers.get("cookie")),
    getRequestIp(request),
  )
}

export const getCurrentUser = getCurrentSessionActor

export { getSessionCookieName } from "@/lib/session"
