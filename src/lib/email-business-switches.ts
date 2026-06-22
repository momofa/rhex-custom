export const EMAIL_BUSINESS_SWITCH_DEFINITIONS = [
  {
    key: "registerVerification",
    label: "注册验证码邮件",
    description: "用户注册或登录补充验证时发送到邮箱的验证码。",
  },
  {
    key: "resetPasswordVerification",
    label: "找回密码验证码邮件",
    description: "用户通过邮箱找回密码时发送的验证码。",
  },
  {
    key: "passwordChangeVerification",
    label: "修改密码验证码邮件",
    description: "用户在个人设置修改密码时发送的邮箱验证码。",
  },
  {
    key: "loginIpChangeAlert",
    label: "登录安全提醒邮件",
    description: "登录 IP 变化时发送给用户的安全提醒。",
  },
  {
    key: "paymentOrderSuccess",
    label: "支付成功通知邮件",
    description: "支付订单履约成功后发送给后台配置收件人的通知。",
  },
  {
    key: "lotteryWinner",
    label: "中奖邮件通知",
    description: "抽奖开奖后发送给中奖用户的邮件。",
  },
  {
    key: "systemNotification",
    label: "系统通知邮件",
    description: "站内系统通知同步到邮箱的提醒。",
  },
  {
    key: "privateMessage",
    label: "私信邮件提醒",
    description: "用户收到私信时同步到邮箱的提醒。",
  },
  {
    key: "addon",
    label: "插件业务邮件",
    description: "插件通过宿主邮件 API 发送的业务邮件。",
  },
] as const

export type EmailBusinessSwitchKey = typeof EMAIL_BUSINESS_SWITCH_DEFINITIONS[number]["key"]

export type EmailBusinessSwitchSettings = Record<EmailBusinessSwitchKey, boolean>

export const DEFAULT_EMAIL_BUSINESS_SWITCH_SETTINGS = EMAIL_BUSINESS_SWITCH_DEFINITIONS.reduce(
  (settings, item) => {
    settings[item.key] = true
    return settings
  },
  {} as EmailBusinessSwitchSettings,
)

export function normalizeEmailBusinessSwitchSettings(
  input: unknown,
  fallback: EmailBusinessSwitchSettings = DEFAULT_EMAIL_BUSINESS_SWITCH_SETTINGS,
): EmailBusinessSwitchSettings {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}

  return EMAIL_BUSINESS_SWITCH_DEFINITIONS.reduce((settings, item) => {
    const fallbackValue = fallback[item.key] ?? DEFAULT_EMAIL_BUSINESS_SWITCH_SETTINGS[item.key]
    settings[item.key] = typeof source[item.key] === "boolean"
      ? source[item.key] as boolean
      : fallbackValue
    return settings
  }, {} as EmailBusinessSwitchSettings)
}

export function isEmailBusinessSwitchEnabled(
  settings: Partial<EmailBusinessSwitchSettings> | null | undefined,
  key: EmailBusinessSwitchKey,
) {
  return settings?.[key] !== false
}
