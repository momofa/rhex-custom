import "server-only"

import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"
import { enqueueBackgroundJob } from "@/lib/background-jobs"
import { getServerSiteSettings } from "@/lib/site-settings"
import type { AddonSmsProviderRuntimeHooks, AddonSmsProviderSendResult } from "@/addons-host/types"
import type { ServerSiteSettingsData } from "@/lib/site-settings.types"

export interface SmsSendInput {
  phone: string
  code?: string
  scene?: "verification" | "notification" | string
  templateCode?: string
  templateParam?: Record<string, unknown>
  signName?: string
  outId?: string
}

export interface SmsSendResult {
  provider: string
  sent: boolean
  queued?: boolean
  jobId?: string
  messageId?: string | null
  requestId?: string | null
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function hasAliyunSmsConfig(settings: ServerSiteSettingsData) {
  return Boolean(
    settings.smsEnabled
    && settings.smsProvider === "aliyun"
    && normalizeOptionalString(settings.smsAliyunAccessKeyId)
    && normalizeOptionalString(settings.smsAliyunAccessKeySecret)
    && normalizeOptionalString(settings.smsAliyunSignName)
    && normalizeOptionalString(settings.smsAliyunTemplateCode),
  )
}

function hasTencentSmsConfig(settings: ServerSiteSettingsData) {
  return Boolean(
    settings.smsEnabled
    && settings.smsProvider === "tencent"
    && normalizeOptionalString(settings.smsTencentSecretId)
    && normalizeOptionalString(settings.smsTencentSecretKey)
    && normalizeOptionalString(settings.smsTencentSmsSdkAppId)
    && normalizeOptionalString(settings.smsTencentSignName)
    && normalizeOptionalString(settings.smsTencentTemplateId),
  )
}

function hasBuiltinSmsConfig(settings: ServerSiteSettingsData) {
  return hasAliyunSmsConfig(settings) || hasTencentSmsConfig(settings)
}

function buildTemplateParam(input: SmsSendInput, settings: ServerSiteSettingsData) {
  if (input.templateParam) {
    return input.templateParam
  }

  if (input.code) {
    const codeKey = normalizeOptionalString(settings.smsAliyunCodeParamName) || "code"
    return { [codeKey]: input.code }
  }

  return {}
}

function normalizeTencentTemplateParamValue(value: unknown) {
  if (value == null) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }

  return JSON.stringify(value)
}

function buildTencentTemplateParamSet(input: SmsSendInput, settings: ServerSiteSettingsData) {
  const templateParam = buildTemplateParam(input, settings)
  const keys = settings.smsTencentTemplateParamKeys.length > 0
    ? settings.smsTencentTemplateParamKeys
    : ["code"]

  return keys.map((key) => normalizeTencentTemplateParamValue(templateParam[key]))
}

function normalizeTencentPhoneNumber(phone: string) {
  const normalized = phone.trim().replace(/[\s-]/g, "")

  if (!normalized) {
    return normalized
  }

  if (normalized.startsWith("+")) {
    return normalized
  }

  return `+86${normalized}`
}

async function sendWithAliyun(input: SmsSendInput, settings: ServerSiteSettingsData): Promise<SmsSendResult> {
  if (!hasAliyunSmsConfig(settings)) {
    throw new Error("站点未配置阿里云短信发送能力")
  }

  const [{ default: DysmsapiClient, SendSmsRequest }, { $OpenApiUtil }] = await Promise.all([
    import("@alicloud/dysmsapi20170525"),
    import("@alicloud/openapi-core"),
  ])
  const client = new DysmsapiClient(new $OpenApiUtil.Config({
    accessKeyId: normalizeOptionalString(settings.smsAliyunAccessKeyId),
    accessKeySecret: normalizeOptionalString(settings.smsAliyunAccessKeySecret),
    endpoint: normalizeOptionalString(settings.smsAliyunEndpoint) || "dysmsapi.aliyuncs.com",
    regionId: normalizeOptionalString(settings.smsAliyunRegionId) || "cn-hangzhou",
  }))
  const response = await client.sendSms(new SendSmsRequest({
    phoneNumbers: input.phone,
    signName: input.signName || normalizeOptionalString(settings.smsAliyunSignName),
    templateCode: input.templateCode || normalizeOptionalString(settings.smsAliyunTemplateCode),
    templateParam: JSON.stringify(buildTemplateParam(input, settings)),
    outId: input.outId,
  }))
  const body = response.body

  if (body?.code !== "OK") {
    throw new Error(body?.message || body?.code || "阿里云短信发送失败")
  }

  return {
    provider: "aliyun",
    sent: true,
    messageId: body.bizId ?? null,
    requestId: body.requestId ?? null,
  }
}

async function sendWithTencent(input: SmsSendInput, settings: ServerSiteSettingsData): Promise<SmsSendResult> {
  if (!hasTencentSmsConfig(settings)) {
    throw new Error("站点未配置腾讯云短信发送能力")
  }

  const tencentcloud = await import("tencentcloud-sdk-nodejs")
  const SmsClient = tencentcloud.default?.sms?.v20210111?.Client
    ?? tencentcloud.sms?.v20210111?.Client

  if (typeof SmsClient !== "function") {
    throw new Error("腾讯云短信 SDK 加载失败")
  }

  const client = new SmsClient({
    credential: {
      secretId: normalizeOptionalString(settings.smsTencentSecretId),
      secretKey: normalizeOptionalString(settings.smsTencentSecretKey),
    },
    region: normalizeOptionalString(settings.smsTencentRegion) || "ap-guangzhou",
    profile: {
      httpProfile: {
        endpoint: normalizeOptionalString(settings.smsTencentEndpoint) || "sms.tencentcloudapi.com",
      },
    },
  })
  const response = await client.SendSms({
    PhoneNumberSet: [normalizeTencentPhoneNumber(input.phone)],
    SmsSdkAppId: normalizeOptionalString(settings.smsTencentSmsSdkAppId),
    SignName: input.signName || normalizeOptionalString(settings.smsTencentSignName),
    TemplateId: input.templateCode || normalizeOptionalString(settings.smsTencentTemplateId),
    TemplateParamSet: buildTencentTemplateParamSet(input, settings),
  })
  const firstStatus = Array.isArray(response?.SendStatusSet) ? response.SendStatusSet[0] : null
  const statusCode = typeof firstStatus?.Code === "string" ? firstStatus.Code : ""

  if (statusCode && statusCode !== "Ok") {
    throw new Error(firstStatus?.Message || statusCode || "腾讯云短信发送失败")
  }

  return {
    provider: "tencent",
    sent: true,
    messageId: firstStatus?.SerialNo ?? null,
    requestId: response?.RequestId ?? null,
  }
}

async function sendWithBuiltinProvider(input: SmsSendInput, settings: ServerSiteSettingsData): Promise<SmsSendResult> {
  if (settings.smsProvider === "tencent") {
    return sendWithTencent(input, settings)
  }

  return sendWithAliyun(input, settings)
}

function normalizeProviderResult(provider: string, value: AddonSmsProviderSendResult | void | null | undefined): SmsSendResult {
  if (!value) {
    return {
      provider,
      sent: true,
    }
  }

  return {
    provider: value.provider || provider,
    sent: value.sent !== false,
    messageId: value.messageId ?? null,
    requestId: value.requestId ?? null,
  }
}

export async function canSendSms() {
  const settings = await getServerSiteSettings()

  if (hasBuiltinSmsConfig(settings)) {
    return true
  }

  const providers = await listAddonProviderRuntimeItems<AddonSmsProviderRuntimeHooks>("sms")
  return providers.some((item) => (
    typeof item.runtime?.send === "function"
    || (
      typeof item.runtime?.sendVerificationCode === "function"
      && typeof item.runtime?.verifyVerificationCode === "function"
    )
  ))
}

export async function deliverSms(input: SmsSendInput): Promise<SmsSendResult> {
  const providers = await listAddonProviderRuntimeItems<AddonSmsProviderRuntimeHooks>("sms")

  for (const item of providers) {
    if (typeof item.runtime?.send !== "function") {
      continue
    }

    const runnable = typeof item.runtime.isRunnable === "function"
      ? await invokeAddonProviderRuntime(item, "isRunnable", () => input)
      : true

    if (runnable === false) {
      continue
    }

    const result = await invokeAddonProviderRuntime(item, "send", () => input)
    return normalizeProviderResult(item.provider.code, result as AddonSmsProviderSendResult | void | null | undefined)
  }

  return sendWithBuiltinProvider(input, await getServerSiteSettings())
}

export async function sendSms(input: SmsSendInput): Promise<SmsSendResult> {
  const result = await enqueueBackgroundJob("sms.send", input)

  return {
    provider: "queued",
    sent: true,
    queued: true,
    jobId: result.job.id,
    messageId: null,
    requestId: null,
  }
}

export async function sendSmsVerificationCode(input: {
  phone: string
  code: string
  purpose?: string
}) {
  return sendSms({
    phone: input.phone,
    code: input.code,
    scene: input.purpose ? `verification:${input.purpose}` : "verification",
  })
}
