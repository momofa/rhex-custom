import crypto from "node:crypto"

import {
  base64UrlDecodeUtf8,
  base64UrlEncodeUtf8,
  consumeOneTimeCaptchaToken,
  hmacSign,
  resolveCaptchaSecret,
  timingSafeEqualString,
} from "@/lib/captcha-common"
import { PublicRouteError } from "@/lib/public-route-error"
import { REDIS_KEY_SCOPES } from "@/lib/redis-keys"

const BUILTIN_CAPTCHA_MISSING_SECRET_MESSAGE = "缺少 CAPTCHA_SECRET_KEY 环境变量，无法校验内建验证码"

export function hasBuiltinCaptchaSecret() {
  return Boolean(process.env.CAPTCHA_SECRET_KEY?.trim())
}

function resolveSecret() {
  return resolveCaptchaSecret({
    primaryEnv: "CAPTCHA_SECRET_KEY",
    missingMessage: BUILTIN_CAPTCHA_MISSING_SECRET_MESSAGE,
  })
}

export function createBuiltinCaptchaToken(text: string, expiresAt: number) {
  const payload = JSON.stringify({ text, expiresAt, nonce: crypto.randomUUID() })
  const encodedPayload = base64UrlEncodeUtf8(payload)
  const signature = hmacSign(resolveSecret(), encodedPayload, "base64url")
  return `${encodedPayload}.${signature}`
}

export async function verifyBuiltinCaptchaToken(token: string | undefined, input: string) {
  if (!token) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const expectedSignature = hmacSign(resolveSecret(), encodedPayload, "base64url")
  if (!timingSafeEqualString(signature, expectedSignature)) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const payload = JSON.parse(base64UrlDecodeUtf8(encodedPayload)) as { text?: string; expiresAt?: number; nonce?: string }
  if (!payload.text || !payload.expiresAt || !payload.nonce || payload.expiresAt < Date.now()) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  if (payload.text.toUpperCase() !== input.trim().toUpperCase()) {
    throw new PublicRouteError("验证码错误")
  }

  await consumeOneTimeCaptchaToken({
    scope: REDIS_KEY_SCOPES.builtinCaptcha.consume,
    keyParts: [payload.nonce],
    expiresAt: payload.expiresAt,
    conflictMessage: "验证码已被使用，请刷新后重试",
  })

  return true
}
