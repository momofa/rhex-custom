import { apiError, apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { isEmailInWhitelist, normalizeEmailAddress } from "@/lib/email"
import { canSendBusinessEmail, sendRegisterVerificationEmail } from "@/lib/mailer"
import { findUserByPhone } from "@/db/password-reset-queries"
import { isValidMainlandPhone, normalizePhoneNumber } from "@/lib/phone"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSessionActorFromRequest } from "@/lib/auth"
import { isVerificationChannel, VerificationChannel } from "@/lib/shared/verification-channel"
import { getServerSiteSettings } from "@/lib/site-settings"
import { sendSmsVerificationCodeWithAddonProviders } from "@/lib/addon-sms-verification"
import { verifySmsSendCaptcha } from "@/lib/sms-send-captcha"
import { SMS_CODE_COOLDOWN_MS, SMS_CODE_COOLDOWN_SECONDS } from "@/lib/sms-verification"
import { sendVerificationCode } from "@/lib/verification"
import { canSendSms } from "@/lib/sms"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"


function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPhone(value: string) {
  return isValidMainlandPhone(value)
}

function normalizePurpose(value: unknown) {
  const purpose = typeof value === "string" ? value.trim().toLowerCase() : ""

  if (!purpose) {
    return undefined
  }

  if (purpose === "register" || purpose === "login") {
    return purpose
  }

  apiError(400, "验证码用途参数不正确")
}

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const rawChannel = requireStringField(body, "channel", "缺少验证码参数").toUpperCase()
  const channel = isVerificationChannel(rawChannel) ? rawChannel : ""
  const purpose = normalizePurpose((body as Record<string, unknown>).purpose)
  const target = channel === VerificationChannel.EMAIL
    ? normalizeEmailAddress(requireStringField(body, "target", "缺少验证码参数"))
    : normalizePhoneNumber(requireStringField(body, "target", "缺少验证码参数"))
  let smsSettings: Awaited<ReturnType<typeof getServerSiteSettings>> | null = null
  let smsUserId: number | null = null


  if (!channel || !target) {
    apiError(400, "缺少验证码参数")
  }

  if (channel === VerificationChannel.EMAIL && !isValidEmail(target)) {
    apiError(400, "邮箱格式不正确")
  }

  if (channel === VerificationChannel.EMAIL) {
    const settings = await getServerSiteSettings()

    if (settings.registerEmailWhitelistEnabled && !isEmailInWhitelist(target, settings.registerEmailWhitelistDomains)) {
      apiError(400, "该邮箱后缀不在注册白名单内")
    }
  }

  if (channel === VerificationChannel.PHONE && !isValidPhone(target)) {
    apiError(400, "手机号格式不正确")
  }

  if (channel === VerificationChannel.PHONE) {
    smsSettings = await getServerSiteSettings()

    if (!(await canSendSms())) {
      apiError(400, "当前站点未配置短信发送能力")
    }

    if (purpose === "login") {
      const user = await findUserByPhone(target)

      if (!user) {
        apiError(404, "该手机号未绑定账号")
      }

      if (user.status === "BANNED") {
        apiError(403, "该账号已被禁用，无法登录")
      }

      if (user.status === "INACTIVE") {
        apiError(403, "该账号未激活，无法登录")
      }

      if (!user.phoneVerifiedAt) {
        apiError(403, "该手机号尚未完成绑定验证")
      }

      smsUserId = user.id
    }

    if (!smsUserId) {
      const requestUser = await getSessionActorFromRequest(request)
      smsUserId = requestUser?.id ?? null
    }
  }

  const guardOptions = createRequestWriteGuardOptions("auth-send-verification-code", {
    request,
    input: {
      channel,
      target,
      purpose,
    },
  })
  const smsGuardOptions = channel === VerificationChannel.PHONE
    ? {
        ...guardOptions,
        cooldownMs: SMS_CODE_COOLDOWN_MS,
        cooldownMessage: `短信验证码已发送，请 ${SMS_CODE_COOLDOWN_SECONDS} 秒后再试`,
      }
    : guardOptions

  return withRequestWriteGuard(smsGuardOptions, async () => {
    if (channel === VerificationChannel.PHONE) {
      await verifySmsSendCaptcha({
        body,
        request,
        settings: smsSettings ?? await getServerSiteSettings(),
      })
    }

    if (channel === VerificationChannel.EMAIL && !(await canSendBusinessEmail("registerVerification"))) {
      apiError(400, "当前站点未配置邮件发送能力或已关闭注册验证码邮件")
    }

    const requestIp = getRequestIp(request)
    const userAgent = request.headers.get("user-agent")
    let expiresAt: string | null | undefined = null

    if (channel === VerificationChannel.EMAIL) {
      const result = await sendVerificationCode({
        channel,
        target,
        ip: requestIp,
        userAgent,
        purpose,
      })

      await sendRegisterVerificationEmail({
        to: target,
        code: result.code,
      })

      expiresAt = result.expiresAt
    } else {
      const result = await sendSmsVerificationCodeWithAddonProviders({
        request,
        phone: target,
        purpose,
        requestIp,
        userAgent,
        userId: smsUserId,
      })

      expiresAt = result.expiresAt
    }

    logRouteWriteSuccess({
      scope: "auth-send-verification-code",
      action: "send-verification-code",
    }, {
      targetId: target,
      extra: {
        channel,
      },
    })

    return apiSuccess({
      expiresAt,
      ...(channel === VerificationChannel.PHONE ? { cooldownSeconds: SMS_CODE_COOLDOWN_SECONDS } : {}),
    }, channel === VerificationChannel.EMAIL ? "验证码已发送到邮箱" : "验证码已发送到手机")

  })
}, {
  errorMessage: "验证码发送失败",
  logPrefix: "[api/auth/send-verification-code] unexpected error",
})
