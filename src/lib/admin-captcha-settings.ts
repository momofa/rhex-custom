import { normalizeCaptchaMode, type CaptchaMode } from "@/lib/shared/config-parsers"

export const TURNSTILE_CAPTCHA_CONFIG_ERROR = "启用 Turnstile 验证码时，必须同时填写 Turnstile Site Key 和 Secret Key"

export interface TurnstileCaptchaSettingsInput {
  registerCaptchaMode: unknown
  loginCaptchaMode: unknown
  smsCaptchaMode: unknown
  turnstileSiteKey?: string | null
  turnstileSecretKey?: string | null
}

export interface TurnstileCaptchaRepairResult {
  requiresRepair: boolean
  registerCaptchaMode: CaptchaMode
  loginCaptchaMode: CaptchaMode
  smsCaptchaMode: CaptchaMode
}

function hasValue(value: string | null | undefined) {
  return Boolean(value?.trim())
}

export function hasTurnstileCaptchaEnabled(input: TurnstileCaptchaSettingsInput) {
  return (
    normalizeCaptchaMode(input.registerCaptchaMode) === "TURNSTILE"
    || normalizeCaptchaMode(input.loginCaptchaMode) === "TURNSTILE"
    || normalizeCaptchaMode(input.smsCaptchaMode) === "TURNSTILE"
  )
}

export function isTurnstileCaptchaConfigComplete(input: Pick<TurnstileCaptchaSettingsInput, "turnstileSiteKey" | "turnstileSecretKey">) {
  return hasValue(input.turnstileSiteKey) && hasValue(input.turnstileSecretKey)
}

export function getTurnstileCaptchaConfigError(input: TurnstileCaptchaSettingsInput) {
  if (hasTurnstileCaptchaEnabled(input) && !isTurnstileCaptchaConfigComplete(input)) {
    return TURNSTILE_CAPTCHA_CONFIG_ERROR
  }

  return null
}

export function resolveTurnstileCaptchaRepair(input: TurnstileCaptchaSettingsInput): TurnstileCaptchaRepairResult {
  const registerCaptchaMode = normalizeCaptchaMode(input.registerCaptchaMode)
  const loginCaptchaMode = normalizeCaptchaMode(input.loginCaptchaMode)
  const smsCaptchaMode = normalizeCaptchaMode(input.smsCaptchaMode)
  const requiresRepair = Boolean(getTurnstileCaptchaConfigError({
    ...input,
    registerCaptchaMode,
    loginCaptchaMode,
    smsCaptchaMode,
  }))

  return {
    requiresRepair,
    registerCaptchaMode: requiresRepair && registerCaptchaMode === "TURNSTILE" ? "OFF" : registerCaptchaMode,
    loginCaptchaMode: requiresRepair && loginCaptchaMode === "TURNSTILE" ? "OFF" : loginCaptchaMode,
    smsCaptchaMode: requiresRepair && smsCaptchaMode === "TURNSTILE" ? "OFF" : smsCaptchaMode,
  }
}
