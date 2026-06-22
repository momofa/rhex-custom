import { NextResponse } from "next/server"

import { apiSuccess, createRouteHandler } from "@/lib/api-route"
import { clearPasskeyCeremonyState, setPasskeyCeremonyState } from "@/lib/auth-flow-state"
import { createPasskeyAuthenticationOptions } from "@/lib/passkey-auth"
import { getServerSiteSettings } from "@/lib/site-settings"

export const POST = createRouteHandler(async ({ request }) => {
  const settings = await getServerSiteSettings()

  if (!settings.authPasskeyEnabled) {
    return NextResponse.json({ code: 403, message: "Passkey 登录暂未开放" }, { status: 403 })
  }

  const options = await createPasskeyAuthenticationOptions(settings)
  const response = NextResponse.json(apiSuccess({ options }, "success"))

  clearPasskeyCeremonyState(response, "login", request)
  await setPasskeyCeremonyState(response, "login", {
    flow: "login",
    challenge: options.challenge,
  }, request)

  return response
}, {
  errorMessage: "获取 Passkey 登录选项失败",
  logPrefix: "[api/auth/passkey/login/options] unexpected error",
})
