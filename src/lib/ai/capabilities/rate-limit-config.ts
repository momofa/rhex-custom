import "server-only"

import { getAiAppConfig, isRecord, updateAiAppConfig } from "@/lib/ai/config"
import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"

/**
 * 日调用上限能力（能力 3）的配置挂在 `app.ai-reply` 的 appStateJson 下，
 * 独立子 key `rateLimit`。默认 dailyMax=0 视为不限。
 *
 * 设计：同一 site 上多个能力共享同一 ai-reply 配置记录；dailyMax 以 appKey
 * 粒度管理（当前仅 app.ai-reply）。如后续接入多 appKey，可在 dailyMaxMap
 * 中按 appKey 分别配置；未命中回落 dailyMax。
 */

export const AI_REPLY_APP_KEY = "app.ai-reply"
export const AI_REPLY_SENSITIVE_KEY = "app.ai-reply"
export const RATE_LIMIT_ENTRY_KEY = "rateLimit"

export type RateLimitConfig = {
  dailyMax: number
}

export const RATE_LIMIT_DEFAULTS: RateLimitConfig = {
  dailyMax: 0,
}

function normalizeRateLimit(raw: unknown): RateLimitConfig {
  const src = isRecord(raw) ? raw : {}
  const parsed = parseNonNegativeSafeInteger(src.dailyMax)
  const dailyMax = parsed ?? RATE_LIMIT_DEFAULTS.dailyMax
  return { dailyMax }
}

export async function getRateLimitConfig(): Promise<RateLimitConfig> {
  const snap = await getAiAppConfig(AI_REPLY_APP_KEY, {
    sensitiveKey: AI_REPLY_SENSITIVE_KEY,
  })
  const appEntry = isRecord(snap.appStateEntry) ? snap.appStateEntry : {}
  return normalizeRateLimit(appEntry[RATE_LIMIT_ENTRY_KEY])
}

export async function updateRateLimitConfig(
  input: Partial<RateLimitConfig>,
): Promise<RateLimitConfig> {
  const snap = await getAiAppConfig(AI_REPLY_APP_KEY, {
    sensitiveKey: AI_REPLY_SENSITIVE_KEY,
  })
  const existingEntry = isRecord(snap.appStateEntry)
    ? { ...(snap.appStateEntry as Record<string, unknown>) }
    : {}
  const existingRateLimit = isRecord(existingEntry[RATE_LIMIT_ENTRY_KEY])
    ? (existingEntry[RATE_LIMIT_ENTRY_KEY] as Record<string, unknown>)
    : {}

  const merged: Record<string, unknown> = { ...existingRateLimit }
  if (input.dailyMax !== undefined) merged.dailyMax = input.dailyMax

  const normalized = normalizeRateLimit(merged)
  existingEntry[RATE_LIMIT_ENTRY_KEY] = { ...normalized }

  await updateAiAppConfig(AI_REPLY_APP_KEY, {
    record: snap.record,
    sensitiveKey: AI_REPLY_SENSITIVE_KEY,
    appStateEntry: existingEntry,
  })
  return normalized
}