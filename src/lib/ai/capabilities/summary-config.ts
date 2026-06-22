import "server-only"

import { getAiAppConfig, isRecord, updateAiAppConfig } from "@/lib/ai/config"
import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

/**
 * AI 总结能力（能力 2）的配置挂在 `app.ai-reply` 同一条 appStateJson 记录下，
 * 以独立子 key `summary` 存放。provider/apiKey 复用 ai-reply 的 provider。
 *
 * 不使用 DB 层的 expiresAt（schema 无此列），TTL 在读取时以 createdAt 判断；
 * clear 接口在后台手动清理老缓存。
 */
const AI_REPLY_APP_KEY = "app.ai-reply"
const AI_REPLY_SENSITIVE_KEY = "aiReplyConfig"
const SUMMARY_ENTRY_KEY = "summary"

export interface SummaryConfig {
  enabled: boolean
  /** 用于 AiSummaryCache.modelKey；留空表示使用 ai-reply 主 model */
  modelKey: string
  /** 系统提示词 */
  systemPrompt: string
  /** 输入正文最大字符数（先 trim 再截断） */
  maxInputChars: number
  /** 输出最大 tokens */
  maxOutputTokens: number
  /** 缓存有效天数，<=0 视为永久 */
  cacheTtlDays: number
}

const SUMMARY_DEFAULTS: SummaryConfig = {
  enabled: false,
  modelKey: "",
  systemPrompt: [
    "你是论坛内容摘要助手。",
    "读取用户提供的帖子或评论正文，输出一段 2-4 句话的中文摘要，",
    "要求：覆盖主题、关键观点、结论/诉求；不要加入额外解释或 markdown。",
  ].join("\n"),
  maxInputChars: 6000,
  maxOutputTokens: 400,
  cacheTtlDays: 30,
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(v)) return true
    if (["0", "false", "no", "off"].includes(v)) return false
  }
  return fallback
}

function normalizeOptionalString(value: unknown, fallback: string, maxLen: number): string {
  const raw = typeof value === "string" ? value : fallback
  return raw.trim().slice(0, maxLen)
}

function normalizeRequiredString(value: unknown, fallback: string, maxLen: number): string {
  const r = normalizeOptionalString(value, fallback, maxLen)
  return r || fallback
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = parsePositiveSafeInteger(value)
  const base = typeof parsed === "number" ? parsed : fallback
  return Math.min(max, Math.max(min, base))
}

function normalizeSummary(entry: unknown): SummaryConfig {
  const cfg = isRecord(entry) ? entry : {}
  const ttlRaw = typeof cfg.cacheTtlDays === "number"
    ? cfg.cacheTtlDays
    : Number(cfg.cacheTtlDays)
  const ttl = Number.isFinite(ttlRaw) ? Math.max(0, Math.min(3650, Math.trunc(ttlRaw))) : SUMMARY_DEFAULTS.cacheTtlDays
  return {
    enabled: normalizeBoolean(cfg.enabled, SUMMARY_DEFAULTS.enabled),
    modelKey: normalizeOptionalString(cfg.modelKey, SUMMARY_DEFAULTS.modelKey, 200),
    systemPrompt: normalizeRequiredString(cfg.systemPrompt, SUMMARY_DEFAULTS.systemPrompt, 4_000),
    maxInputChars: clampInt(cfg.maxInputChars, SUMMARY_DEFAULTS.maxInputChars, 500, 32_000),
    maxOutputTokens: clampInt(cfg.maxOutputTokens, SUMMARY_DEFAULTS.maxOutputTokens, 64, 4_000),
    cacheTtlDays: ttl,
  }
}

export async function getSummaryConfig(): Promise<SummaryConfig> {
  const { appStateEntry } = await getAiAppConfig(AI_REPLY_APP_KEY, { sensitiveKey: AI_REPLY_SENSITIVE_KEY })
  const raw = appStateEntry && isRecord(appStateEntry[SUMMARY_ENTRY_KEY])
    ? appStateEntry[SUMMARY_ENTRY_KEY]
    : null
  return normalizeSummary(raw)
}

export interface UpdateSummaryInput {
  enabled?: unknown
  modelKey?: unknown
  systemPrompt?: unknown
  maxInputChars?: unknown
  maxOutputTokens?: unknown
  cacheTtlDays?: unknown
}

export async function updateSummaryConfig(input: UpdateSummaryInput): Promise<SummaryConfig> {
  const snap = await getAiAppConfig(AI_REPLY_APP_KEY, { sensitiveKey: AI_REPLY_SENSITIVE_KEY })
  const existingEntry: Record<string, unknown> = snap.appStateEntry ? { ...snap.appStateEntry } : {}
  const current = isRecord(existingEntry[SUMMARY_ENTRY_KEY])
    ? (existingEntry[SUMMARY_ENTRY_KEY] as Record<string, unknown>)
    : {}

  const merged: Record<string, unknown> = { ...current }
  if (input.enabled !== undefined) merged.enabled = input.enabled
  if (input.modelKey !== undefined) merged.modelKey = input.modelKey
  if (input.systemPrompt !== undefined) merged.systemPrompt = input.systemPrompt
  if (input.maxInputChars !== undefined) merged.maxInputChars = input.maxInputChars
  if (input.maxOutputTokens !== undefined) merged.maxOutputTokens = input.maxOutputTokens
  if (input.cacheTtlDays !== undefined) merged.cacheTtlDays = input.cacheTtlDays

  const normalized = normalizeSummary(merged)
  existingEntry[SUMMARY_ENTRY_KEY] = { ...normalized }

  await updateAiAppConfig(AI_REPLY_APP_KEY, {
    record: snap.record,
    sensitiveKey: AI_REPLY_SENSITIVE_KEY,
    appStateEntry: existingEntry,
  })
  return normalized
}

export { SUMMARY_DEFAULTS }