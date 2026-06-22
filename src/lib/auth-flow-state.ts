import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

import type { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { shouldUseSecureCookies } from "@/lib/cookie-security"
import type { OAuthFlowState, PasskeyCeremonyState, PendingExternalAuthState } from "@/lib/external-auth-types"
import { createRedisKey, getRedis } from "@/lib/redis"

const PENDING_AUTH_COOKIE_NAME = "bbs_pending_auth"
const PASSKEY_REGISTER_COOKIE_NAME = "bbs_passkey_register"
const PASSKEY_LOGIN_COOKIE_NAME = "bbs_passkey_login"
const PASSKEY_CONNECT_COOKIE_NAME = "bbs_passkey_connect"

interface SignedAuthFlowPointer {
  nonce: string
}

function getAuthFlowSecret() {
  const secret = process.env.AUTH_FLOW_SECRET?.trim() || process.env.SESSION_SECRET?.trim()

  if (!secret) {
    throw new Error("缺少 AUTH_FLOW_SECRET 或 SESSION_SECRET 环境变量")
  }

  return secret
}

function encodePayload(payload: string) {
  return Buffer.from(payload, "utf8").toString("base64url")
}

function decodePayload(payload: string) {
  return Buffer.from(payload, "base64url").toString("utf8")
}

function signPayload(payload: string) {
  return createHmac("sha256", getAuthFlowSecret()).update(payload).digest("hex")
}

function verifySignature(payload: string, signature: string) {
  const expected = signPayload(payload)
  const left = Buffer.from(signature, "utf8")
  const right = Buffer.from(expected, "utf8")

  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

function createSignedValue<T extends object>(value: T, ttlSeconds: number) {
  const expiresAt = Date.now() + ttlSeconds * 1000
  const payload = encodePayload(JSON.stringify({ ...value, expiresAt }))
  const signature = signPayload(payload)
  return `${payload}.${signature}`
}

function parseSignedValue<T extends object>(token: string | undefined) {
  if (!token) {
    return null
  }

  const [payload, signature] = token.split(".")

  if (!payload || !signature || !verifySignature(payload, signature)) {
    return null
  }

  try {
    const parsed = JSON.parse(decodePayload(payload)) as T & { expiresAt?: number }
    if (!parsed || typeof parsed !== "object" || typeof parsed.expiresAt !== "number") {
      return null
    }

    if (parsed.expiresAt <= Date.now()) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function getCookieOptions(maxAge: number, request?: Pick<Request, "headers" | "url"> | null) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies({ request }),
    path: "/",
    maxAge,
  }
}

function clearCookie(response: NextResponse, cookieName: string, request?: Pick<Request, "headers" | "url"> | null) {
  response.cookies.set(cookieName, "", getCookieOptions(0, request))
}

function getRedisAuthFlowKey(cookieName: string, nonce: string) {
  return createRedisKey("auth-flow", cookieName, nonce)
}

async function setCookie<T extends object>(
  response: NextResponse,
  cookieName: string,
  value: T,
  ttlSeconds: number,
  request?: Pick<Request, "headers" | "url"> | null,
) {

  const nonce = randomUUID()
  const expiresAt = Date.now() + ttlSeconds * 1000

  await getRedis().set(
    getRedisAuthFlowKey(cookieName, nonce),
    JSON.stringify({
      ...value,
      expiresAt,
    }),
    "EX",
    ttlSeconds,
  )

  response.cookies.set(cookieName, createSignedValue<SignedAuthFlowPointer>({ nonce }, ttlSeconds), getCookieOptions(ttlSeconds, request))
}

async function readCookieValue<T extends object>(cookieName: string) {
  const cookieStore = await cookies()
  const rawValue = cookieStore.get(cookieName)?.value


  const pointer = parseSignedValue<SignedAuthFlowPointer>(rawValue)

  if (pointer?.nonce) {
    const rawStoredValue = await getRedis().get(getRedisAuthFlowKey(cookieName, pointer.nonce))

    if (!rawStoredValue) {
      return null
    }

    try {
      const parsed = JSON.parse(rawStoredValue) as T & { expiresAt?: number }

      if (!parsed || typeof parsed !== "object" || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
        return null
      }

      return parsed
    } catch {
      return null
    }
  }

  return parseSignedValue<T>(rawValue)
}

export function buildOAuthStateCookieName(provider: string) {
  return `bbs_oauth_${provider}`
}

export async function setOAuthFlowState(response: NextResponse, provider: string, value: OAuthFlowState, request?: Pick<Request, "headers" | "url"> | null, ttlSeconds = 600) {
  await setCookie(response, buildOAuthStateCookieName(provider), value, ttlSeconds, request)
}

export async function readOAuthFlowState(provider: string) {
  return readCookieValue<OAuthFlowState>(buildOAuthStateCookieName(provider))
}

export function clearOAuthFlowState(response: NextResponse, provider: string, request?: Pick<Request, "headers" | "url"> | null) {
  clearCookie(response, buildOAuthStateCookieName(provider), request)
}

export async function setPendingExternalAuthState(response: NextResponse, value: PendingExternalAuthState, request?: Pick<Request, "headers" | "url"> | null, ttlSeconds = 900) {
  await setCookie(response, PENDING_AUTH_COOKIE_NAME, value, ttlSeconds, request)
}

export async function readPendingExternalAuthState() {
  return readCookieValue<PendingExternalAuthState>(PENDING_AUTH_COOKIE_NAME)
}

export function clearPendingExternalAuthState(response: NextResponse, request?: Pick<Request, "headers" | "url"> | null) {
  clearCookie(response, PENDING_AUTH_COOKIE_NAME, request)
}

function getPasskeyCeremonyCookieName(flow: "register" | "login" | "connect") {
  if (flow === "register") {
    return PASSKEY_REGISTER_COOKIE_NAME
  }

  if (flow === "connect") {
    return PASSKEY_CONNECT_COOKIE_NAME
  }

  return PASSKEY_LOGIN_COOKIE_NAME
}

export async function setPasskeyCeremonyState(response: NextResponse, flow: "register" | "login" | "connect", value: PasskeyCeremonyState, request?: Pick<Request, "headers" | "url"> | null, ttlSeconds = 600) {
  await setCookie(response, getPasskeyCeremonyCookieName(flow), value, ttlSeconds, request)
}

export async function readPasskeyCeremonyState(flow: "register" | "login" | "connect") {
  return readCookieValue<PasskeyCeremonyState>(getPasskeyCeremonyCookieName(flow))
}

export function clearPasskeyCeremonyState(response: NextResponse, flow: "register" | "login" | "connect", request?: Pick<Request, "headers" | "url"> | null) {
  clearCookie(response, getPasskeyCeremonyCookieName(flow), request)
}
