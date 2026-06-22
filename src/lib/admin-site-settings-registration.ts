import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { parseEmailWhitelistDomains } from "@/lib/email"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import {
  mergeRegisterEmailWhitelistSettings,
  mergeAuthPageShowcaseSettings,
  mergeAuthProviderSettings,
  mergeRegisterInviteCodeHelpSettings,
  mergeRegisterNicknameLengthSettings,
  mergeRegisterPasswordPolicySettings,
  mergeRegistrationEmailTemplateSettings,
  mergeRegistrationRewardSettings,
  mergeEmailBusinessSwitchSettings,
  mergeSiteSecuritySettings,
  mergeSmsProviderSettings,
  mergeUsernameSensitiveWordSettings,
  resolveRegisterInviteCodeHelpSettings,
  resolveRegisterEmailWhitelistSettings,
  resolveRegistrationEmailTemplateSettings,
  resolveRegisterNicknameLengthSettings,
  resolveRegisterPasswordPolicySettings,
  resolveRegistrationRewardSettings,
  resolveEmailBusinessSwitchSettings,
  resolveSiteSecuritySettings,
  resolveSmsProviderSettings,
  resolveUsernameSensitiveWordSettings,
} from "@/lib/site-settings-app-state"
import { normalizeEmailBusinessSwitchSettings } from "@/lib/email-business-switches"
import { mergeAuthProviderSensitiveConfig, mergeCaptchaSensitiveConfig, mergeSmsSensitiveConfig, resolveSmsSensitiveConfig } from "@/lib/site-settings-sensitive-state"
import { normalizeCaptchaMode } from "@/lib/shared/config-parsers"
import { normalizeUsernameSensitiveWords } from "@/lib/username-sensitive-words"
import { normalizePasswordMinLength, normalizePasswordStrength } from "@/lib/password-policy"
import { getTurnstileCaptchaConfigError } from "@/lib/admin-captcha-settings"
import type { SmsBuiltinProvider } from "@/lib/site-settings-app-state.types"

function isSupportedInviteCodeHelpUrl(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value)
}

function normalizeSmsBuiltinProvider(value: unknown): SmsBuiltinProvider {
  return typeof value === "string" && value.trim().toLowerCase() === "tencent"
    ? "tencent"
    : "aliyun"
}

function parseSmsTemplateParamKeys(value: string) {
  const normalized = Array.from(new Set(
    value
      .split(/[，,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  ))

  return normalized.length > 0 ? normalized : ["code"]
}

export async function updateRegistrationSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section !== "site-registration") {
    return null
  }

  const inviteRewardInviter = Math.max(0, readOptionalNumberField(body, "inviteRewardInviter") ?? 0)
  const inviteRewardInvitee = Math.max(0, readOptionalNumberField(body, "inviteRewardInvitee") ?? 0)
  const existingRegistrationRewardSettings = resolveRegistrationRewardSettings({
    appStateJson: existing.appStateJson,
    initialPointsFallback: 0,
  })
  const existingRegistrationEmailTemplateSettings = resolveRegistrationEmailTemplateSettings({
    appStateJson: existing.appStateJson,
    siteNameFallback: existing.siteName,
  })
  const existingEmailBusinessSwitches = resolveEmailBusinessSwitchSettings({
    appStateJson: existing.appStateJson,
  })
  const existingRegisterInviteCodeHelpSettings = resolveRegisterInviteCodeHelpSettings({
    appStateJson: existing.appStateJson,
  })
  const existingRegisterEmailWhitelistSettings = resolveRegisterEmailWhitelistSettings({
    appStateJson: existing.appStateJson,
  })
  const registerInitialPoints = Math.max(0, readOptionalNumberField(body, "registerInitialPoints") ?? existingRegistrationRewardSettings.initialPoints)
  const existingRegisterNicknameLengthSettings = resolveRegisterNicknameLengthSettings({
    appStateJson: existing.appStateJson,
    minLengthFallback: 1,
    maxLengthFallback: 20,
  })
  const existingRegisterPasswordPolicySettings = resolveRegisterPasswordPolicySettings({
    appStateJson: existing.appStateJson,
    minLengthFallback: 6,
    strengthFallback: "LOW",
  })
  const registrationEnabled = Boolean(body.registrationEnabled)
  const authPageShowcaseEnabled = "authPageShowcaseEnabled" in body ? Boolean(body.authPageShowcaseEnabled) : true
  const registrationRequireInviteCode = Boolean(body.registrationRequireInviteCode)
  const registerInviteCodeEnabled = Boolean(body.registerInviteCodeEnabled)
  const registerInviteCodeHelpEnabled = registerInviteCodeEnabled && Boolean(body.registerInviteCodeHelpEnabled)
  const registerInviteCodeHelpTitle = readOptionalStringField(body, "registerInviteCodeHelpTitle") || existingRegisterInviteCodeHelpSettings.title
  const registerInviteCodeHelpUrl = readOptionalStringField(body, "registerInviteCodeHelpUrl") || existingRegisterInviteCodeHelpSettings.url
  const inviteCodePurchaseEnabled = Boolean(body.inviteCodePurchaseEnabled)
  const registerCaptchaMode = normalizeCaptchaMode(body.registerCaptchaMode)
  const loginCaptchaMode = normalizeCaptchaMode(body.loginCaptchaMode)
  const turnstileSiteKey = readOptionalStringField(body, "turnstileSiteKey") || null
  const turnstileSecretKey = readOptionalStringField(body, "turnstileSecretKey") || null
  const registerEmailEnabled = Boolean(body.registerEmailEnabled)
  const registerEmailRequired = registerEmailEnabled && Boolean(body.registerEmailRequired)
  const registerEmailVerification = registerEmailEnabled && Boolean(body.registerEmailVerification)
  const registerEmailWhitelistEnabled = registerEmailEnabled && Boolean(body.registerEmailWhitelistEnabled)
  const existingSiteSecuritySettings = resolveSiteSecuritySettings({
    appStateJson: existing.appStateJson,
  })
  const existingUsernameSensitiveWordSettings = resolveUsernameSensitiveWordSettings({
    appStateJson: existing.appStateJson,
  })
  const sessionIpMismatchLogoutEnabled = "sessionIpMismatchLogoutEnabled" in body
    ? Boolean(body.sessionIpMismatchLogoutEnabled)
    : existingSiteSecuritySettings.sessionIpMismatchLogoutEnabled
  const loginIpChangeEmailAlertEnabled = "loginIpChangeEmailAlertEnabled" in body
    ? Boolean(body.loginIpChangeEmailAlertEnabled)
    : existingSiteSecuritySettings.loginIpChangeEmailAlertEnabled
  const passwordChangeRequireEmailVerification = "passwordChangeRequireEmailVerification" in body
    ? Boolean(body.passwordChangeRequireEmailVerification)
    : existingSiteSecuritySettings.passwordChangeRequireEmailVerification
  const oauthServerEnabled = "oauthServerEnabled" in body
    ? Boolean(body.oauthServerEnabled)
    : existingSiteSecuritySettings.oauthServerEnabled
  const oauthClientApplicationEnabled = "oauthClientApplicationEnabled" in body
    ? Boolean(body.oauthClientApplicationEnabled)
    : existingSiteSecuritySettings.oauthClientApplicationEnabled
  const oauthAccessTokenTtlMinutes = Math.min(
    1440,
    Math.max(
      5,
      Math.floor(readOptionalNumberField(body, "oauthAccessTokenTtlMinutes") ?? existingSiteSecuritySettings.oauthAccessTokenTtlMinutes),
    ),
  )
  const oauthRefreshTokenTtlDays = Math.min(
    365,
    Math.max(
      1,
      Math.floor(readOptionalNumberField(body, "oauthRefreshTokenTtlDays") ?? existingSiteSecuritySettings.oauthRefreshTokenTtlDays),
    ),
  )
  const registerPasswordMinLength = normalizePasswordMinLength(
    "registerPasswordMinLength" in body ? body.registerPasswordMinLength : undefined,
    existingRegisterPasswordPolicySettings.minLength,
  )
  const registerPasswordStrength = normalizePasswordStrength(
    "registerPasswordStrength" in body ? body.registerPasswordStrength : undefined,
    existingRegisterPasswordPolicySettings.strength,
  )
  const usernameSensitiveWordsEnabled = "usernameSensitiveWordsEnabled" in body
    ? Boolean(body.usernameSensitiveWordsEnabled)
    : existingUsernameSensitiveWordSettings.usernameSensitiveWordsEnabled
  const usernameSensitiveWords = "usernameSensitiveWords" in body
    ? normalizeUsernameSensitiveWords(body.usernameSensitiveWords)
    : existingUsernameSensitiveWordSettings.usernameSensitiveWords
  const registerEmailWhitelistDomainsInput = "registerEmailWhitelistDomains" in body
    ? readOptionalStringField(body, "registerEmailWhitelistDomains")
    : existingRegisterEmailWhitelistSettings.domains.join("\n")
  const {
    domains: registerEmailWhitelistDomains,
    invalidDomains: invalidRegisterEmailWhitelistDomains,
  } = parseEmailWhitelistDomains(registerEmailWhitelistDomainsInput)
  const registerPhoneEnabled = Boolean(body.registerPhoneEnabled)
  const registerPhoneRequired = registerPhoneEnabled && Boolean(body.registerPhoneRequired)
  const registerPhoneVerification = registerPhoneEnabled && Boolean(body.registerPhoneVerification)
  const registerNicknameEnabled = Boolean(body.registerNicknameEnabled)
  const registerNicknameRequired = registerNicknameEnabled && Boolean(body.registerNicknameRequired)
  const registerNicknameMinLength = Math.max(1, readOptionalNumberField(body, "registerNicknameMinLength") ?? existingRegisterNicknameLengthSettings.minLength)
  const registerNicknameMaxLength = Math.max(1, readOptionalNumberField(body, "registerNicknameMaxLength") ?? existingRegisterNicknameLengthSettings.maxLength)
  const registerGenderEnabled = Boolean(body.registerGenderEnabled)
  const registerGenderRequired = registerGenderEnabled && Boolean(body.registerGenderRequired)
  const registerInviterEnabled = Boolean(body.registerInviterEnabled)
  const authGithubEnabled = Boolean(body.authGithubEnabled)
  const authGoogleEnabled = Boolean(body.authGoogleEnabled)
  const authPasskeyEnabled = Boolean(body.authPasskeyEnabled)
  const existingSmsProviderSettings = resolveSmsProviderSettings({
    appStateJson: existing.appStateJson,
  })
  const smsEnabled = Boolean(body.smsEnabled)
  const smsCaptchaMode = "smsCaptchaMode" in body
    ? normalizeCaptchaMode(body.smsCaptchaMode)
    : existingSmsProviderSettings.captchaMode
  const smsProvider = "smsProvider" in body
    ? normalizeSmsBuiltinProvider(body.smsProvider)
    : existingSmsProviderSettings.provider
  const smsAliyunAccessKeyId = readOptionalStringField(body, "smsAliyunAccessKeyId") || null
  const smsAliyunAccessKeySecret = readOptionalStringField(body, "smsAliyunAccessKeySecret") || null
  const smsAliyunEndpoint = readOptionalStringField(body, "smsAliyunEndpoint") || existingSmsProviderSettings.aliyunEndpoint
  const smsAliyunRegionId = readOptionalStringField(body, "smsAliyunRegionId") || existingSmsProviderSettings.aliyunRegionId
  const smsAliyunSignName = readOptionalStringField(body, "smsAliyunSignName") || null
  const smsAliyunTemplateCode = readOptionalStringField(body, "smsAliyunTemplateCode") || null
  const smsAliyunCodeParamName = readOptionalStringField(body, "smsAliyunCodeParamName") || existingSmsProviderSettings.aliyunCodeParamName
  const smsTencentSecretId = readOptionalStringField(body, "smsTencentSecretId") || null
  const smsTencentSecretKey = readOptionalStringField(body, "smsTencentSecretKey") || null
  const smsTencentRegion = readOptionalStringField(body, "smsTencentRegion") || existingSmsProviderSettings.tencentRegion
  const smsTencentEndpoint = readOptionalStringField(body, "smsTencentEndpoint") || existingSmsProviderSettings.tencentEndpoint
  const smsTencentSmsSdkAppId = readOptionalStringField(body, "smsTencentSmsSdkAppId") || null
  const smsTencentSignName = readOptionalStringField(body, "smsTencentSignName") || null
  const smsTencentTemplateId = readOptionalStringField(body, "smsTencentTemplateId") || null
  const smsTencentTemplateParamKeys = parseSmsTemplateParamKeys(
    readOptionalStringField(body, "smsTencentTemplateParamKeys")
    || existingSmsProviderSettings.tencentTemplateParamKeys.join(","),
  )
  const githubClientId = readOptionalStringField(body, "githubClientId") || null
  const githubClientSecret = readOptionalStringField(body, "githubClientSecret") || null
  const googleClientId = readOptionalStringField(body, "googleClientId") || null
  const googleClientSecret = readOptionalStringField(body, "googleClientSecret") || null
  const passkeyRpId = readOptionalStringField(body, "passkeyRpId") || null
  const passkeyRpName = readOptionalStringField(body, "passkeyRpName") || null
  const passkeyOrigin = readOptionalStringField(body, "passkeyOrigin") || null
  const smtpEnabled = Boolean(body.smtpEnabled)
  const smtpHost = readOptionalStringField(body, "smtpHost") || null
  const smtpPortRaw = readOptionalNumberField(body, "smtpPort") ?? 0
  const smtpPort = smtpPortRaw > 0 ? smtpPortRaw : null
  const smtpUser = readOptionalStringField(body, "smtpUser") || null
  const smtpPass = readOptionalStringField(body, "smtpPass") || null
  const smtpFrom = readOptionalStringField(body, "smtpFrom") || null
  const smtpSecure = Boolean(body.smtpSecure)
  const registerVerificationEmailSubject = readOptionalStringField(body, "registerVerificationEmailSubject") || existingRegistrationEmailTemplateSettings.registerVerification.subject
  const registerVerificationEmailText = readOptionalStringField(body, "registerVerificationEmailText") || existingRegistrationEmailTemplateSettings.registerVerification.text
  const registerVerificationEmailHtml = readOptionalStringField(body, "registerVerificationEmailHtml") || existingRegistrationEmailTemplateSettings.registerVerification.html
  const resetPasswordEmailSubject = readOptionalStringField(body, "resetPasswordEmailSubject") || existingRegistrationEmailTemplateSettings.resetPasswordVerification.subject
  const resetPasswordEmailText = readOptionalStringField(body, "resetPasswordEmailText") || existingRegistrationEmailTemplateSettings.resetPasswordVerification.text
  const resetPasswordEmailHtml = readOptionalStringField(body, "resetPasswordEmailHtml") || existingRegistrationEmailTemplateSettings.resetPasswordVerification.html
  const passwordChangeEmailSubject = readOptionalStringField(body, "passwordChangeEmailSubject") || existingRegistrationEmailTemplateSettings.passwordChangeVerification.subject
  const passwordChangeEmailText = readOptionalStringField(body, "passwordChangeEmailText") || existingRegistrationEmailTemplateSettings.passwordChangeVerification.text
  const passwordChangeEmailHtml = readOptionalStringField(body, "passwordChangeEmailHtml") || existingRegistrationEmailTemplateSettings.passwordChangeVerification.html
  const loginIpChangeAlertEmailSubject = readOptionalStringField(body, "loginIpChangeAlertEmailSubject") || existingRegistrationEmailTemplateSettings.loginIpChangeAlert.subject
  const loginIpChangeAlertEmailText = readOptionalStringField(body, "loginIpChangeAlertEmailText") || existingRegistrationEmailTemplateSettings.loginIpChangeAlert.text
  const loginIpChangeAlertEmailHtml = readOptionalStringField(body, "loginIpChangeAlertEmailHtml") || existingRegistrationEmailTemplateSettings.loginIpChangeAlert.html
  const paymentOrderSuccessEmailSubject = readOptionalStringField(body, "paymentOrderSuccessEmailSubject") || existingRegistrationEmailTemplateSettings.paymentOrderSuccessNotification.subject
  const paymentOrderSuccessEmailText = readOptionalStringField(body, "paymentOrderSuccessEmailText") || existingRegistrationEmailTemplateSettings.paymentOrderSuccessNotification.text
  const paymentOrderSuccessEmailHtml = readOptionalStringField(body, "paymentOrderSuccessEmailHtml") || existingRegistrationEmailTemplateSettings.paymentOrderSuccessNotification.html
  const emailBusinessSwitches = normalizeEmailBusinessSwitchSettings(
    "emailBusinessSwitches" in body ? body.emailBusinessSwitches : undefined,
    existingEmailBusinessSwitches,
  )

  if (registrationRequireInviteCode && !registerInviteCodeEnabled) {
    apiError(400, "注册要求必须填写邀请码时，不能关闭邀请码输入框显示")
  }

  if (registerInviteCodeHelpEnabled && !registerInviteCodeHelpUrl) {
    apiError(400, "开启邀请码输入框链接时，必须填写链接地址")
  }

  if (registerInviteCodeHelpUrl && !isSupportedInviteCodeHelpUrl(registerInviteCodeHelpUrl)) {
    apiError(400, "邀请码输入框链接仅支持以 /、http:// 或 https:// 开头")
  }

  const turnstileConfigError = getTurnstileCaptchaConfigError({
    registerCaptchaMode,
    loginCaptchaMode,
    smsCaptchaMode,
    turnstileSiteKey,
    turnstileSecretKey,
  })
  if (turnstileConfigError) {
    apiError(400, turnstileConfigError)
  }

  if (invalidRegisterEmailWhitelistDomains.length > 0) {
    apiError(400, `邮箱白名单后缀格式不正确：${invalidRegisterEmailWhitelistDomains.slice(0, 5).join("、")}`)
  }

  if (registerEmailWhitelistEnabled && registerEmailWhitelistDomains.length === 0) {
    apiError(400, "开启邮箱白名单时，至少填写一个邮箱后缀")
  }

  if (smtpEnabled && (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom)) {
    apiError(400, "开启 SMTP 时请完整填写主机、端口、账号、密码和发件人地址")
  }

  if (smsEnabled && smsProvider === "aliyun" && (!smsAliyunAccessKeyId || !smsAliyunAccessKeySecret || !smsAliyunSignName || !smsAliyunTemplateCode)) {
    apiError(400, "开启内置阿里云短信时请完整填写 AccessKey、短信签名和模板 Code")
  }

  if (smsEnabled && smsProvider === "tencent" && (!smsTencentSecretId || !smsTencentSecretKey || !smsTencentSmsSdkAppId || !smsTencentSignName || !smsTencentTemplateId)) {
    apiError(400, "开启内置腾讯云短信时请完整填写 SecretId、SecretKey、SDK AppID、短信签名和模板 ID")
  }

  if (registerNicknameMaxLength < registerNicknameMinLength) {
    apiError(400, "昵称最大字符数不能小于最小字符数")
  }

  const appStateWithRegistrationRewards = mergeRegistrationRewardSettings(existing.appStateJson, {
    initialPoints: registerInitialPoints,
  })
  const appStateWithRegistrationEmailTemplates = mergeRegistrationEmailTemplateSettings(appStateWithRegistrationRewards, {
    registerVerification: {
      subject: registerVerificationEmailSubject,
      text: registerVerificationEmailText,
      html: registerVerificationEmailHtml,
    },
    resetPasswordVerification: {
      subject: resetPasswordEmailSubject,
      text: resetPasswordEmailText,
      html: resetPasswordEmailHtml,
    },
    passwordChangeVerification: {
      subject: passwordChangeEmailSubject,
      text: passwordChangeEmailText,
      html: passwordChangeEmailHtml,
    },
    loginIpChangeAlert: {
      subject: loginIpChangeAlertEmailSubject,
      text: loginIpChangeAlertEmailText,
      html: loginIpChangeAlertEmailHtml,
    },
    paymentOrderSuccessNotification: {
      subject: paymentOrderSuccessEmailSubject,
      text: paymentOrderSuccessEmailText,
      html: paymentOrderSuccessEmailHtml,
    },
  })
  const appStateWithAuthProviders = mergeAuthProviderSettings(appStateWithRegistrationEmailTemplates, {
    githubEnabled: authGithubEnabled,
    googleEnabled: authGoogleEnabled,
    passkeyEnabled: authPasskeyEnabled,
  })
  const appStateWithAuthPageShowcase = mergeAuthPageShowcaseSettings(appStateWithAuthProviders, {
    enabled: authPageShowcaseEnabled,
  })
  const appStateWithRegisterNicknameLengths = mergeRegisterNicknameLengthSettings(appStateWithAuthPageShowcase, {
    minLength: registerNicknameMinLength,
    maxLength: registerNicknameMaxLength,
  })
  const appStateWithRegisterPasswordPolicy = mergeRegisterPasswordPolicySettings(appStateWithRegisterNicknameLengths, {
    minLength: registerPasswordMinLength,
    strength: registerPasswordStrength,
  })
  const appStateWithRegisterInviteCodeHelp = mergeRegisterInviteCodeHelpSettings(appStateWithRegisterPasswordPolicy, {
    enabled: registerInviteCodeHelpEnabled,
    title: registerInviteCodeHelpTitle,
    url: registerInviteCodeHelpUrl,
  })
  const appStateWithSiteSecurity = mergeSiteSecuritySettings(appStateWithRegisterInviteCodeHelp, {
    sessionIpMismatchLogoutEnabled,
    loginIpChangeEmailAlertEnabled,
    passwordChangeRequireEmailVerification,
    oauthServerEnabled,
    oauthClientApplicationEnabled,
    paymentApplicationEnabled: existingSiteSecuritySettings.paymentApplicationEnabled,
    paymentPlatformFeePercent: existingSiteSecuritySettings.paymentPlatformFeePercent,
    oauthAccessTokenTtlMinutes,
    oauthRefreshTokenTtlDays,
  })
  const appStateWithUsernameSensitiveWords = mergeUsernameSensitiveWordSettings(appStateWithSiteSecurity, {
    usernameSensitiveWordsEnabled,
    usernameSensitiveWords,
  })
  const appStateWithRegisterEmailWhitelist = mergeRegisterEmailWhitelistSettings(appStateWithUsernameSensitiveWords, {
    enabled: registerEmailWhitelistEnabled,
    domains: registerEmailWhitelistDomains,
  })
  const appStateWithSmsProvider = mergeSmsProviderSettings(appStateWithRegisterEmailWhitelist, {
    enabled: smsEnabled,
    provider: smsProvider,
    captchaMode: smsCaptchaMode,
    aliyunEndpoint: smsAliyunEndpoint,
    aliyunRegionId: smsAliyunRegionId,
    aliyunSignName: smsAliyunSignName ?? "",
    aliyunTemplateCode: smsAliyunTemplateCode ?? "",
    aliyunCodeParamName: smsAliyunCodeParamName,
    tencentRegion: smsTencentRegion,
    tencentEndpoint: smsTencentEndpoint,
    tencentSmsSdkAppId: smsTencentSmsSdkAppId ?? "",
    tencentSignName: smsTencentSignName ?? "",
    tencentTemplateId: smsTencentTemplateId ?? "",
    tencentTemplateParamKeys: smsTencentTemplateParamKeys,
  })
  const appStateJson = mergeEmailBusinessSwitchSettings(appStateWithSmsProvider, emailBusinessSwitches)
  const currentSensitiveStateJson = ("sensitiveStateJson" in existing ? existing.sensitiveStateJson : null) ?? null
  const sensitiveStateWithAuthProvider = mergeAuthProviderSensitiveConfig(currentSensitiveStateJson, {
    githubClientId,
    githubClientSecret,
    googleClientId,
    googleClientSecret,
    passkeyRpId,
    passkeyRpName,
    passkeyOrigin,
  })
  const sensitiveStateWithCaptcha = mergeCaptchaSensitiveConfig(sensitiveStateWithAuthProvider, {
    turnstileSecretKey: registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE" || smsCaptchaMode === "TURNSTILE"
      ? turnstileSecretKey
      : null,
  })
  const existingSmsSensitiveConfig = resolveSmsSensitiveConfig(currentSensitiveStateJson)
  const sensitiveStateJson = mergeSmsSensitiveConfig(sensitiveStateWithCaptcha, {
    aliyunAccessKeyId: smsEnabled ? smsAliyunAccessKeyId : existingSmsSensitiveConfig.aliyunAccessKeyId,
    aliyunAccessKeySecret: smsEnabled ? smsAliyunAccessKeySecret : existingSmsSensitiveConfig.aliyunAccessKeySecret,
    tencentSecretId: smsEnabled ? smsTencentSecretId : existingSmsSensitiveConfig.tencentSecretId,
    tencentSecretKey: smsEnabled ? smsTencentSecretKey : existingSmsSensitiveConfig.tencentSecretKey,
  })

  const settings = await updateSiteSettingsRecord(existing.id, {
    inviteRewardInviter,
    inviteRewardInvitee,
    registrationEnabled,
    registrationRequireInviteCode,
    registerInviteCodeEnabled,
    inviteCodePurchaseEnabled,
    registerCaptchaMode,
    loginCaptchaMode,
    turnstileSiteKey: registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE" || smsCaptchaMode === "TURNSTILE" ? turnstileSiteKey : null,
    registerEmailEnabled,
    registerEmailRequired,
    registerEmailVerification,
    registerPhoneEnabled,
    registerPhoneRequired,
    registerPhoneVerification,
    registerNicknameEnabled,
    registerNicknameRequired,
    registerGenderEnabled,
    registerGenderRequired,
    registerInviterEnabled,
    appStateJson,
    sensitiveStateJson,
    smtpEnabled,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpSecure,
  })

  return finalizeSiteSettingsUpdate({
    settings,
    message: "注册与邀请设置已保存",
  })
}
