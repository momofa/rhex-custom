import { NextResponse } from "next/server"

import { apiError, apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"
import { clearPasskeyCeremonyState, setPasskeyCeremonyState } from "@/lib/auth-flow-state"
import { normalizeEmailAddress } from "@/lib/email"
import { createPasskeyRegistrationOptions } from "@/lib/passkey-auth"
import { getServerSiteSettings } from "@/lib/site-settings"

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value)
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const POST = createRouteHandler(async ({ request }) => {
  const settings = await getServerSiteSettings()

  if (!settings.authPasskeyEnabled) {
    apiError(403, "Passkey 登录暂未开放")
  }

  const body = await readJsonBody(request)
  const username = typeof body.username === "string" ? body.username.trim() : ""
  const email = typeof body.email === "string" ? normalizeEmailAddress(body.email) : ""

  if (!isValidUsername(username)) {
    apiError(400, "用户名需为 3-20 位字母、数字或下划线")
  }

  if (email && !isValidEmail(email)) {
    apiError(400, "邮箱格式不正确")
  }

  const options = await createPasskeyRegistrationOptions(settings, {
    username,
    displayName: username,
  })
  const response = NextResponse.json(apiSuccess({ options }, "success"))

  clearPasskeyCeremonyState(response, "register", request)
  await setPasskeyCeremonyState(response, "register", {
    flow: "register",
    challenge: options.challenge,
    usernameCandidate: username,
    emailCandidate: email || undefined,
    displayName: username,
  }, request)

  return response
}, {
  errorMessage: "获取 Passkey 注册选项失败",
  logPrefix: "[api/auth/passkey/register/options] unexpected error",
})
