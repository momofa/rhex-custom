import "server-only"

import { apiError, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { verifyPowCaptchaSolution } from "@/lib/pow-captcha"
import { getRequestIp } from "@/lib/request-ip"
import type { ServerSiteSettingsData } from "@/lib/site-settings.types"
import { verifyTurnstileToken } from "@/lib/turnstile"

export async function verifySmsSendCaptcha(options: {
  body: JsonObject
  request: Request
  settings: ServerSiteSettingsData
}) {
  const mode = options.settings.smsCaptchaMode

  if (mode === "OFF") {
    return
  }

  const captchaToken = readOptionalStringField(options.body, "captchaToken")
  const builtinCaptchaCode = readOptionalStringField(options.body, "builtinCaptchaCode")
  const powNonce = readOptionalStringField(options.body, "powNonce")

  if (mode === "TURNSTILE") {
    if (!options.settings.turnstileSiteKey || !options.settings.turnstileSecretKey) {
      apiError(500, "站点未完成 Turnstile 验证码配置，请联系管理员")
    }

    if (!captchaToken) {
      apiError(400, "请先完成验证码验证")
    }

    await verifyTurnstileToken(captchaToken, getRequestIp(options.request), options.settings.turnstileSecretKey)
    return
  }

  if (mode === "BUILTIN") {
    if (!captchaToken || !builtinCaptchaCode) {
      apiError(400, "请先完成图形验证码验证")
    }

    await verifyBuiltinCaptchaToken(captchaToken, builtinCaptchaCode)
    return
  }

  if (mode === "POW") {
    if (!captchaToken || !powNonce) {
      apiError(400, "请先完成工作量证明验证")
    }

    await verifyPowCaptchaSolution({
      challenge: captchaToken,
      nonce: powNonce,
      scope: "sms",
      requestIp: getRequestIp(options.request),
    })
  }
}

