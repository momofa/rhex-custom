import { prisma } from "@/db/client"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"

// 插件密钥统一落在 SiteSetting.sensitiveStateJson 内的嵌套 namespace，便于后续集中加密 / 审计。
// 设计意图：
//  - 单一真源（Single Source of Truth）：Database-Only，不再双写本地文件，避免多副本裂脑与权限/泄露面扩大。
//  - 12-Factor『配置随进程走』：机密只活在托管数据库里，镜像 / 日志 / 磁盘快照不可能再无意捕获 addons-secrets.json。
//  - 失败显式化：DB 不可用即直接抛错，由调用方选择重试 / 熔断，禁止静默降级到文件导致策略被绕过。
const SITE_SETTINGS_SENSITIVE_KEY = "__siteSensitiveSettings"
const ADDON_SECRETS_STATE_KEY = "__addonSecrets"

// 进程内串行队列：同一实例内 read-modify-write 的多次并发写入必须按顺序提交，
// 避免 later-writer 覆盖 earlier-writer 的 sensitiveStateJson 合并结果。
// 注意：跨实例并发仍需依赖上层分布式锁（若未来存在多写入者，应引入 redis-lease）。
let addonSecretsMutationQueue: Promise<void> = Promise.resolve()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseJsonRoot(raw: string | null | undefined) {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function runAddonSecretsMutation<T>(task: () => Promise<T>) {
  const run = addonSecretsMutationQueue.then(task, task)
  // 队列本身只记录「完成/失败」事件；把具体失败透传给调用方的 await，避免未处理 rejection 污染队列。
  addonSecretsMutationQueue = run.then(() => undefined, () => undefined)
  return run
}

function readSensitiveSiteSettingsState(raw: string | null | undefined) {
  const root = parseJsonRoot(raw)
  const state = root[SITE_SETTINGS_SENSITIVE_KEY]
  return isRecord(state) ? state : {}
}

function readAddonSecretsState(raw: string | null | undefined) {
  const state = readSensitiveSiteSettingsState(raw)
  const addonSecrets = state[ADDON_SECRETS_STATE_KEY]
  return isRecord(addonSecrets) ? addonSecrets : {}
}

async function getOrCreateSiteSettingsSensitiveRecord() {
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      sensitiveStateJson: true,
    },
  })

  if (existing) {
    return existing
  }

  return prisma.siteSetting.create({
    data: defaultSiteSettingsCreateInput,
    select: {
      id: true,
      sensitiveStateJson: true,
    },
  })
}

function mergeAddonSecretState(
  sensitiveStateJson: string | null | undefined,
  addonId: string,
  secretKey: string,
  value: unknown,
) {
  const root = parseJsonRoot(sensitiveStateJson)
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)
  const addonSecrets = readAddonSecretsState(sensitiveStateJson)
  const nextAddonSecretState = {
    ...(addonSecrets[addonId] && isRecord(addonSecrets[addonId]) ? addonSecrets[addonId] as Record<string, unknown> : {}),
    [secretKey]: value,
  }

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    [ADDON_SECRETS_STATE_KEY]: {
      ...addonSecrets,
      [addonId]: nextAddonSecretState,
    },
  }

  return JSON.stringify(root)
}

function removeAddonSecretState(
  sensitiveStateJson: string | null | undefined,
  addonId: string,
) {
  const root = parseJsonRoot(sensitiveStateJson)
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)
  const addonSecrets = {
    ...readAddonSecretsState(sensitiveStateJson),
  }

  if (addonId in addonSecrets) {
    delete addonSecrets[addonId]
  }

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    [ADDON_SECRETS_STATE_KEY]: addonSecrets,
  }

  return JSON.stringify(root)
}

// 读取单个插件密钥。Database-Only：若底层 Prisma/DB 不可用，错误直接抛出，
// 让上游（插件 setup / HTTP 处理器）决定是重试、熔断还是降级业务，而不是静默回退到不受信的本地文件。
export async function readAddonSecretValue<T = unknown>(addonId: string, secretKey: string, fallback?: T) {
  const databaseRecord = await prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      sensitiveStateJson: true,
    },
  })

  const sensitiveState = readAddonSecretsState(databaseRecord?.sensitiveStateJson)
  const scoped = sensitiveState[addonId]
  if (!isRecord(scoped)) {
    return fallback as T
  }

  const databaseValue = scoped[secretKey]
  if (typeof databaseValue === "undefined") {
    return fallback as T
  }

  // 允许显式 null 作为"已存储的空值"；仅 undefined 才回落 fallback，语义明确。
  return (databaseValue as T) ?? (fallback as T)
}

// 写入 / 更新插件密钥。走串行队列保证同进程内 RMW 合并安全；DB 异常透传给调用方。
export async function writeAddonSecretValue<T = unknown>(addonId: string, secretKey: string, value: T) {
  await runAddonSecretsMutation(async () => {
    const record = await getOrCreateSiteSettingsSensitiveRecord()
    await prisma.siteSetting.update({
      where: { id: record.id },
      data: {
        sensitiveStateJson: mergeAddonSecretState(record.sensitiveStateJson, addonId, secretKey, value),
      },
    })
  })
}

// 卸载插件时批量清空其命名空间。记录缺失视为无事可做（幂等）。
export async function deleteAddonSecretValues(addonId: string) {
  await runAddonSecretsMutation(async () => {
    const record = await prisma.siteSetting.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        sensitiveStateJson: true,
      },
    })

    if (!record) {
      return
    }

    await prisma.siteSetting.update({
      where: { id: record.id },
      data: {
        sensitiveStateJson: removeAddonSecretState(record.sensitiveStateJson, addonId),
      },
    })
  })
}
