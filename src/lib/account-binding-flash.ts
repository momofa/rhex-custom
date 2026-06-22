import type { NextResponse } from "next/server"

import { shouldUseSecureCookies } from "@/lib/cookie-security"

const ACCOUNT_BINDING_FLASH_COOKIE_NAME = "bbs_account_binding_flash"

export interface AccountBindingFlashState {
  type: "success" | "error"
  message: string
}

export function setAccountBindingFlash(response: NextResponse, value: AccountBindingFlashState, request?: Pick<Request, "headers" | "url"> | null) {
  response.cookies.set(ACCOUNT_BINDING_FLASH_COOKIE_NAME, encodeURIComponent(JSON.stringify(value)), {
    httpOnly: false,
    sameSite: "lax",
    secure: shouldUseSecureCookies({ request }),
    path: "/",
    maxAge: 120,
  })
}

export function clearAccountBindingFlashOnClient() {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${ACCOUNT_BINDING_FLASH_COOKIE_NAME}=; Max-Age=0; path=/`
}

function tryParseFlashState(rawValue: string) {
  const candidates = [rawValue]

  try {
    candidates.push(decodeURIComponent(rawValue))
  } catch {}

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as AccountBindingFlashState
      if ((parsed.type === "success" || parsed.type === "error") && typeof parsed.message === "string") {
        return parsed
      }
    } catch {}
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(decodeURIComponent(candidate)) as AccountBindingFlashState
      if ((parsed.type === "success" || parsed.type === "error") && typeof parsed.message === "string") {
        return parsed
      }
    } catch {}
  }

  return null
}

export function readAccountBindingFlashOnClient(): AccountBindingFlashState | null {
  if (typeof document === "undefined") {
    return null
  }

  const cookieValue = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${ACCOUNT_BINDING_FLASH_COOKIE_NAME}=`))
    ?.slice(ACCOUNT_BINDING_FLASH_COOKIE_NAME.length + 1)

  if (!cookieValue) {
    return null
  }

  return tryParseFlashState(cookieValue)
}
