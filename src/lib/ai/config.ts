import { prisma } from "@/db/client"

import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"

/**
 * 站点级 sensitiveStateJson 根对象里，所有敏感应用配置统一挂在这个 key 下，
 * 外层 sensitiveStateJson 预留给其它非应用类敏感字段。
 */
export const SITE_SETTINGS_SENSITIVE_KEY = "__siteSensitiveSettings"

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/**
 * 容错解析一个 JSON 字符串根对象：非法 / 非对象 / 数组 一律返回 `{}`。
 */
export function parseJsonRoot(raw: string | null | undefined): Record<string, unknown> {
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

/**
 * 从 sensitiveStateJson 中读出挂在 `SITE_SETTINGS_SENSITIVE_KEY` 下的对象，
 * 不存在 / 非对象返回 `{}`。
 */
export function readSensitiveSection(raw: string | null | undefined): Record<string, unknown> {
  const root = parseJsonRoot(raw)
  const state = root[SITE_SETTINGS_SENSITIVE_KEY]
  return isRecord(state) ? state : {}
}

/**
 * 单条 SiteSetting 行（聚合式单表）中与 AI 应用配置有关的 3 个字段。
 */
export interface AiAppConfigRecord {
  id: string
  appStateJson: string | null
  sensitiveStateJson: string | null
}

/**
 * 读取后的原始快照：record + 指定 appKey / sensitiveKey 对应的"原始"子对象。
 * 这两个子对象**未经业务 normalize**，业务层负责字段归一 / 默认值填充。
 */
export interface AiAppConfigSnapshot {
  record: AiAppConfigRecord
  /** appStateJson 根对象里 root[appKey] 指向的对象；不存在 / 非对象时为 null */
  appStateEntry: Record<string, unknown> | null
  /** sensitiveStateJson 里 root[SITE_SETTINGS_SENSITIVE_KEY][sensitiveKey] 指向的对象；缺失返回 `{}` */
  sensitiveEntry: Record<string, unknown>
}

async function getOrCreateSiteSettingsRecord(): Promise<AiAppConfigRecord> {
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      appStateJson: true,
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
      appStateJson: true,
      sensitiveStateJson: true,
    },
  })
}

/**
 * 聚合读取某个 AI 应用的原始配置快照：appStateJson[appKey] 与
 * sensitiveStateJson[SITE_SETTINGS_SENSITIVE_KEY][sensitiveKey]。
 *
 * 幂等：若站点尚未创建 SiteSetting 行，会用 `defaultSiteSettingsCreateInput` 创建。
 */
export async function getAiAppConfig(
  appKey: string,
  opts: { sensitiveKey: string },
): Promise<AiAppConfigSnapshot> {
  const record = await getOrCreateSiteSettingsRecord()
  const root = parseJsonRoot(record.appStateJson)
  const entry = root[appKey]
  const sensitive = readSensitiveSection(record.sensitiveStateJson)
  const sensitiveEntry = sensitive[opts.sensitiveKey]

  return {
    record,
    appStateEntry: isRecord(entry) ? entry : null,
    sensitiveEntry: isRecord(sensitiveEntry) ? sensitiveEntry : {},
  }
}

export interface UpdateAiAppConfigInput {
  /** 必填：目标 SiteSetting 行（通常从同一次 getAiAppConfig 拿到）。 */
  record: AiAppConfigRecord
  /** 敏感命名空间的子 key（如 `"aiReplyConfig"`）。 */
  sensitiveKey: string
  /**
   * 整体替换 root[appKey] 的内容（业务层已组装好完整记录）。
   * undefined = 不改 appStateJson。
   */
  appStateEntry?: Record<string, unknown>
  /**
   * 整体替换 sensitive[sensitiveKey] 的内容。
   * undefined = 不改 sensitiveStateJson；
   * null      = 从 sensitive 根里删除这一子 key。
   * 同一 sensitive 根下其它兄弟 key 会被保留。
   */
  sensitiveEntry?: Record<string, unknown> | null
}

function serializeAppStateRoot(
  currentJson: string | null | undefined,
  appKey: string,
  entry: Record<string, unknown>,
): string {
  const root = parseJsonRoot(currentJson)
  root[appKey] = entry
  return JSON.stringify(root)
}

function serializeSensitiveRoot(
  currentJson: string | null | undefined,
  sensitiveKey: string,
  entry: Record<string, unknown> | null,
): string {
  const root = parseJsonRoot(currentJson)
  const state = readSensitiveSection(currentJson)
  const next: Record<string, unknown> = { ...state }

  if (entry === null) {
    delete next[sensitiveKey]
  } else {
    next[sensitiveKey] = entry
  }

  root[SITE_SETTINGS_SENSITIVE_KEY] = next
  return JSON.stringify(root)
}

/**
 * 单行 prisma.siteSetting.update：按 patch 语义分别序列化 appStateJson / sensitiveStateJson。
 * 若两个 patch 都未提供则直接返回，不打 DB。
 */
export async function updateAiAppConfig(
  appKey: string,
  input: UpdateAiAppConfigInput,
): Promise<void> {
  const data: { appStateJson?: string; sensitiveStateJson?: string } = {}

  if (input.appStateEntry !== undefined) {
    data.appStateJson = serializeAppStateRoot(
      input.record.appStateJson,
      appKey,
      input.appStateEntry,
    )
  }

  if (input.sensitiveEntry !== undefined) {
    data.sensitiveStateJson = serializeSensitiveRoot(
      input.record.sensitiveStateJson,
      input.sensitiveKey,
      input.sensitiveEntry,
    )
  }

  if (Object.keys(data).length === 0) {
    return
  }

  await prisma.siteSetting.update({
    where: { id: input.record.id },
    data,
  })
}