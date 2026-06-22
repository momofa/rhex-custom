import "server-only"

import type {
  AddonSmsProviderRuntimeHooks,
  AddonSmsVerificationCodeSendResult,
  AddonSmsVerificationCodeVerifyResult,
} from "@/addons-host/types"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { apiError } from "@/lib/api-route"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"
import { getRequestIp } from "@/lib/request-ip"
import { VerificationChannel } from "@/lib/shared/verification-channel"
import { sendSmsVerificationCode } from "@/lib/sms"
import { sendVerificationCode, verifyCode } from "@/lib/verification"

const DEFAULT_SMS_VERIFICATION_PURPOSE = "register"

interface SmsVerificationBaseInput {
  phone: string
  purpose?: string | null
  request?: Request
  requestIp?: string | null
  userAgent?: string | null
  userId?: number | null
}

interface SmsVerificationCodeSendInput extends SmsVerificationBaseInput {
  code?: never
}

interface SmsVerificationCodeVerifyInput extends SmsVerificationBaseInput {
  code: string
}

function normalizePurpose(value: string | null | undefined) {
  return value?.trim() || DEFAULT_SMS_VERIFICATION_PURPOSE
}

function getRequestMetadata(input: SmsVerificationBaseInput) {
  return {
    requestIp: input.requestIp ?? (input.request ? getRequestIp(input.request) : null),
    userAgent: input.userAgent ?? input.request?.headers.get("user-agent") ?? null,
  }
}

function getHookExecutionInput(input: SmsVerificationBaseInput, throwOnError = false) {
  if (!input.request) {
    return { throwOnError }
  }

  const requestUrl = new URL(input.request.url)
  return {
    request: input.request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError,
  }
}

function normalizeProviderSendResult(
  providerCode: string,
  output: boolean | AddonSmsVerificationCodeSendResult | void | null,
) {
  if (output === false) {
    return null
  }

  if (!output || output === true) {
    return {
      provider: providerCode,
      sent: true,
      expiresAt: null,
      message: null,
      messageId: null,
      requestId: null,
    }
  }

  if (output.handled === false) {
    return null
  }

  return {
    provider: output.provider?.trim() || providerCode,
    sent: output.sent !== false,
    expiresAt: output.expiresAt ?? null,
    message: output.message ?? null,
    messageId: output.messageId ?? null,
    requestId: output.requestId ?? null,
  }
}

function normalizeProviderVerifyResult(
  providerCode: string,
  output: boolean | string | AddonSmsVerificationCodeVerifyResult | void | null,
) {
  if (output === false) {
    return {
      handled: true,
      ok: false,
      provider: providerCode,
      message: null,
      verifiedAt: null,
    }
  }

  if (typeof output === "string") {
    return {
      handled: true,
      ok: false,
      provider: providerCode,
      message: output.trim() || null,
      verifiedAt: null,
    }
  }

  if (!output || output === true) {
    return {
      handled: true,
      ok: true,
      provider: providerCode,
      message: null,
      verifiedAt: null,
    }
  }

  if (output.handled === false) {
    return null
  }

  return {
    handled: true,
    ok: output.ok !== false,
    provider: output.provider?.trim() || providerCode,
    message: output.message ?? null,
    verifiedAt: output.verifiedAt ?? null,
  }
}

async function listSmsProviders(request?: Request) {
  return listAddonProviderRuntimeItems<AddonSmsProviderRuntimeHooks>("sms", request ? { request } : undefined)
}

export async function sendSmsVerificationCodeWithAddonProviders(input: SmsVerificationCodeSendInput) {
  const purpose = normalizePurpose(input.purpose)
  const metadata = getRequestMetadata(input)

  await executeAddonActionHook("sms.verification-code.send.before", {
    phone: input.phone,
    purpose,
    requestIp: metadata.requestIp,
    userAgent: metadata.userAgent,
    userId: input.userId ?? null,
  }, getHookExecutionInput(input, true))

  const providers = await listSmsProviders(input.request)

  for (const item of providers) {
    if (
      typeof item.runtime?.sendVerificationCode !== "function"
      || typeof item.runtime?.verifyVerificationCode !== "function"
    ) {
      continue
    }

    const output = await invokeAddonProviderRuntime(item, "sendVerificationCode", () => ({
      phone: input.phone,
      purpose,
      requestIp: metadata.requestIp,
      userAgent: metadata.userAgent,
      userId: input.userId ?? null,
    }))
    const normalized = normalizeProviderSendResult(
      item.provider.code,
      output as boolean | AddonSmsVerificationCodeSendResult | void | null,
    )

    if (!normalized) {
      continue
    }

    if (!normalized.sent) {
      apiError(400, normalized.message || `${item.provider.label} 短信验证码发送失败`)
    }

    await executeAddonActionHook("sms.verification-code.send.after", {
      phone: input.phone,
      purpose,
      requestIp: metadata.requestIp,
      userAgent: metadata.userAgent,
      userId: input.userId ?? null,
      provider: normalized.provider,
      handledByProvider: true,
      expiresAt: normalized.expiresAt,
      sent: true,
      messageId: normalized.messageId,
      requestId: normalized.requestId,
    }, getHookExecutionInput(input))

    return {
      provider: normalized.provider,
      handledByProvider: true,
      expiresAt: normalized.expiresAt,
      message: normalized.message,
      messageId: normalized.messageId,
      requestId: normalized.requestId,
    }
  }

  const verification = await sendVerificationCode({
    channel: VerificationChannel.PHONE,
    target: input.phone,
    ip: metadata.requestIp,
    userAgent: metadata.userAgent,
    userId: input.userId,
    purpose,
  })
  const delivery = await sendSmsVerificationCode({
    phone: input.phone,
    code: verification.code,
    purpose,
  })

  await executeAddonActionHook("sms.verification-code.send.after", {
    phone: input.phone,
    purpose,
    requestIp: metadata.requestIp,
    userAgent: metadata.userAgent,
    userId: input.userId ?? null,
    provider: delivery.provider,
    handledByProvider: false,
    expiresAt: verification.expiresAt,
    sent: true,
    messageId: delivery.messageId ?? null,
    requestId: delivery.requestId ?? null,
  }, getHookExecutionInput(input))

  return {
    provider: delivery.provider,
    handledByProvider: false,
    expiresAt: verification.expiresAt,
    message: null,
    messageId: delivery.messageId ?? null,
    requestId: delivery.requestId ?? null,
  }
}

export async function verifySmsVerificationCodeWithAddonProviders(input: SmsVerificationCodeVerifyInput) {
  const purpose = normalizePurpose(input.purpose)
  const metadata = getRequestMetadata(input)

  await executeAddonActionHook("sms.verification-code.verify.before", {
    phone: input.phone,
    purpose,
    requestIp: metadata.requestIp,
    userAgent: metadata.userAgent,
    userId: input.userId ?? null,
  }, getHookExecutionInput(input, true))

  const providers = await listSmsProviders(input.request)

  for (const item of providers) {
    if (
      typeof item.runtime?.sendVerificationCode !== "function"
      || typeof item.runtime?.verifyVerificationCode !== "function"
    ) {
      continue
    }

    const output = await invokeAddonProviderRuntime(item, "verifyVerificationCode", () => ({
      phone: input.phone,
      code: input.code,
      purpose,
      requestIp: metadata.requestIp,
      userAgent: metadata.userAgent,
      userId: input.userId ?? null,
    }))
    const normalized = normalizeProviderVerifyResult(
      item.provider.code,
      output as boolean | string | AddonSmsVerificationCodeVerifyResult | void | null,
    )

    if (!normalized) {
      continue
    }

    if (!normalized.ok) {
      apiError(400, normalized.message || `${item.provider.label} 短信验证码校验未通过`)
    }

    const verifiedAt = normalized.verifiedAt ?? new Date().toISOString()

    await executeAddonActionHook("sms.verification-code.verify.after", {
      phone: input.phone,
      purpose,
      requestIp: metadata.requestIp,
      userAgent: metadata.userAgent,
      userId: input.userId ?? null,
      provider: normalized.provider,
      handledByProvider: true,
      ok: true,
      verifiedAt,
    }, getHookExecutionInput(input))

    return {
      provider: normalized.provider,
      handledByProvider: true,
      verifiedAt: new Date(verifiedAt),
    }
  }

  const verified = await verifyCode({
    channel: VerificationChannel.PHONE,
    target: input.phone,
    code: input.code,
    purpose,
  })
  const verifiedAt = verified.consumedAt.toISOString()

  await executeAddonActionHook("sms.verification-code.verify.after", {
    phone: input.phone,
    purpose,
    requestIp: metadata.requestIp,
    userAgent: metadata.userAgent,
    userId: input.userId ?? null,
    provider: "builtin",
    handledByProvider: false,
    ok: true,
    verifiedAt,
  }, getHookExecutionInput(input))

  return {
    provider: "builtin",
    handledByProvider: false,
    verifiedAt: verified.consumedAt,
  }
}
