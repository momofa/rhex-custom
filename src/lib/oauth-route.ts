import { NextResponse } from "next/server"

import { OAuthProtocolError } from "@/lib/oauth-server"

export function oauthJsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")
  headers.set("Pragma", "no-cache")

  return NextResponse.json(body, {
    ...init,
    headers,
  })
}

export function oauthErrorResponse(error: unknown, fallbackDescription: string) {
  if (error instanceof OAuthProtocolError) {
    return oauthJsonResponse({
      error: error.error,
      ...(error.description ? { error_description: error.description } : {}),
    }, {
      status: error.status,
      headers: error.status === 401
        ? { "WWW-Authenticate": `Bearer error="${error.error}"` }
        : undefined,
    })
  }

  console.error("[oauth] unexpected error", error)
  return oauthJsonResponse({
    error: "server_error",
    error_description: fallbackDescription,
  }, { status: 500 })
}
