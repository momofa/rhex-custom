import { hashSync } from "bcryptjs"

import { VerificationChannel } from "@/lib/shared/verification-channel"

import { findUserByEmail, findUserByPhone, updateUserPasswordById } from "@/db/password-reset-queries"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import {
  sendSmsVerificationCodeWithAddonProviders,
  verifySmsVerificationCodeWithAddonProviders,
} from "@/lib/addon-sms-verification"
import { apiError } from "@/lib/api-route"
import { normalizeEmailAddress } from "@/lib/email"
import { getSiteSettings } from "@/lib/site-settings"
import { validatePasswordPolicy, type PasswordPolicySettings } from "@/lib/password-policy"
import { canSendBusinessEmail, sendResetPasswordVerificationEmail } from "@/lib/mailer"
import { sendVerificationCode, verifyCode } from "@/lib/verification"
import { isValidMainlandPhone, normalizePhoneNumber } from "@/lib/phone"
import { canSendSms } from "@/lib/sms"


const PASSWORD_RESET_PURPOSE = "password_reset"

function ensurePassword(value: string, policy: PasswordPolicySettings) {
  const password = value.trim()
  const result = validatePasswordPolicy(password, policy)

  if (!result.success) {
    apiError(400, result.message)
  }

  return password
}


export function getPasswordResetPurpose() {
  return PASSWORD_RESET_PURPOSE
}

export async function sendPasswordResetCode(input: {
  email: string
  ip?: string | null
  userAgent?: string | null
}) {
  const email = normalizeEmailAddress(input.email)

  if (!email) {
    apiError(400, "请输入邮箱")
  }

  const smtpReady = await canSendBusinessEmail("resetPasswordVerification")

  if (!smtpReady) {
    apiError(400, "当前站点未配置邮件发送能力或已关闭找回密码验证码邮件，暂不可找回密码")
  }

  const user = await findUserByEmail(email)

  if (!user) {
    apiError(404, "该邮箱未绑定账号")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被禁用，无法找回密码")
  }

  if (user.status === "INACTIVE") {
    apiError(403, "该账号未激活，无法找回密码")
  }


  const result = await sendVerificationCode({
    channel: VerificationChannel.EMAIL,
    target: email,
    ip: input.ip,
    userAgent: input.userAgent,
    userId: user.id,
    purpose: PASSWORD_RESET_PURPOSE,
  })

  await sendResetPasswordVerificationEmail({
    to: email,
    code: result.code,
    username: user.username,
  })

  return {
    expiresAt: result.expiresAt,
    username: user.username,
  }
}

export async function sendPasswordResetPhoneCode(input: {
  phone: string
  request?: Request
  ip?: string | null
  userAgent?: string | null
}) {
  const phone = normalizePhoneNumber(input.phone)

  if (!isValidMainlandPhone(phone)) {
    apiError(400, "手机号格式不正确")
  }

  if (!(await canSendSms())) {
    apiError(400, "当前站点未配置短信发送能力，暂不可通过手机找回密码")
  }

  const user = await findUserByPhone(phone)

  if (!user) {
    apiError(404, "该手机号未绑定账号")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被禁用，无法找回密码")
  }

  if (user.status === "INACTIVE") {
    apiError(403, "该账号未激活，无法找回密码")
  }

  if (!user.phoneVerifiedAt) {
    apiError(403, "该手机号尚未完成绑定验证")
  }

  const result = await sendSmsVerificationCodeWithAddonProviders({
    request: input.request,
    phone,
    requestIp: input.ip,
    userAgent: input.userAgent,
    purpose: PASSWORD_RESET_PURPOSE,
    userId: user.id,
  })

  return {
    expiresAt: result.expiresAt,
    username: user.username,
  }
}

export async function resetPasswordByEmailCode(input: {
  email: string
  code: string
  password: string
  request?: Request
}) {
  const email = normalizeEmailAddress(input.email)
  const settings = await getSiteSettings()
  const password = ensurePassword(input.password, {
    minLength: settings.registerPasswordMinLength,
    strength: settings.registerPasswordStrength,
  })
  const code = input.code.trim()

  if (!email) {
    apiError(400, "请输入邮箱")
  }

  if (!/^\d{6}$/.test(code)) {
    apiError(400, "验证码格式不正确")
  }

  const user = await findUserByEmail(email)

  if (!user) {
    apiError(404, "该邮箱未绑定账号")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被禁用，无法重置密码")
  }

  if (user.status === "INACTIVE") {
    apiError(403, "该账号未激活，无法重置密码")
  }


  await verifyCode({
    channel: VerificationChannel.EMAIL,
    target: email,
    code,
    purpose: PASSWORD_RESET_PURPOSE,
  })

  const hookInput = (() => {
    if (!input.request) {
      return { throwOnError: true }
    }

    const requestUrl = new URL(input.request.url)
    return {
      request: input.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    }
  })()

  await executeAddonActionHook("auth.password.reset.before", {
    userId: user.id,
    username: user.username,
    email: user.email,
  }, hookInput)

  const updatedUser = await updateUserPasswordById(user.id, hashSync(password, 10))

  await executeAddonActionHook("auth.password.reset.after", {
    userId: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
  }, input.request
    ? {
        request: input.request,
        pathname: new URL(input.request.url).pathname,
        searchParams: new URL(input.request.url).searchParams,
      }
    : undefined)

  return updatedUser
}

export async function resetPasswordByPhoneCode(input: {
  phone: string
  code: string
  password: string
  request?: Request
}) {
  const phone = normalizePhoneNumber(input.phone)
  const settings = await getSiteSettings()
  const password = ensurePassword(input.password, {
    minLength: settings.registerPasswordMinLength,
    strength: settings.registerPasswordStrength,
  })
  const code = input.code.trim()

  if (!isValidMainlandPhone(phone)) {
    apiError(400, "手机号格式不正确")
  }

  if (!/^\d{6}$/.test(code)) {
    apiError(400, "验证码格式不正确")
  }

  const user = await findUserByPhone(phone)

  if (!user) {
    apiError(404, "该手机号未绑定账号")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被禁用，无法重置密码")
  }

  if (user.status === "INACTIVE") {
    apiError(403, "该账号未激活，无法重置密码")
  }

  if (!user.phoneVerifiedAt) {
    apiError(403, "该手机号尚未完成绑定验证")
  }

  await verifySmsVerificationCodeWithAddonProviders({
    request: input.request,
    phone,
    code,
    purpose: PASSWORD_RESET_PURPOSE,
    userId: user.id,
  })

  const hookInput = (() => {
    if (!input.request) {
      return { throwOnError: true }
    }

    const requestUrl = new URL(input.request.url)
    return {
      request: input.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    }
  })()

  await executeAddonActionHook("auth.password.reset.before", {
    userId: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
  }, hookInput)

  const updatedUser = await updateUserPasswordById(user.id, hashSync(password, 10))

  await executeAddonActionHook("auth.password.reset.after", {
    userId: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
    phone: updatedUser.phone,
  }, input.request
    ? {
        request: input.request,
        pathname: new URL(input.request.url).pathname,
        searchParams: new URL(input.request.url).searchParams,
      }
    : undefined)

  return updatedUser
}
