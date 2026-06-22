import { formatNumber } from "@/lib/formatters"
import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"
import { getVipLevel, isVipActive, type VipStateSource } from "@/lib/vip-status"
import { TaskRewardTier } from "@/db/types"

export interface TaskRewardRange {
  min: number
  max: number
}

export interface TieredTaskRewardSettings {
  normal: TaskRewardRange
  vip1: TaskRewardRange
  vip2: TaskRewardRange
  vip3: TaskRewardRange
}

function tryParseNonNegativeSafeInteger(value: unknown) {
  try {
    return parseNonNegativeSafeInteger(value)
  } catch {
    return null
  }
}

function normalizeRewardBound(value: unknown, fallback: number) {
  return tryParseNonNegativeSafeInteger(value) ?? fallback
}

export function normalizeTaskRewardRange(
  value: Partial<TaskRewardRange> | null | undefined,
  fallback: TaskRewardRange = { min: 0, max: 0 },
): TaskRewardRange {
  const minValue = normalizeRewardBound(value?.min, normalizeRewardBound(fallback.min, 0))
  const maxValue = normalizeRewardBound(value?.max, normalizeRewardBound(fallback.max, minValue))

  return {
    min: Math.min(minValue, maxValue),
    max: Math.max(minValue, maxValue),
  }
}

export function parseTaskRewardRangeInput(value: unknown): TaskRewardRange | null {
  if (typeof value === "number") {
    const normalized = tryParseNonNegativeSafeInteger(value)
    return normalized === null ? null : { min: normalized, max: normalized }
  }

  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().replace(/\s+/g, "").replace(/[,，]/g, "").replace(/[~～－—–]/g, "-")
  if (!normalized) {
    return null
  }

  const singleValue = tryParseNonNegativeSafeInteger(normalized)
  if (singleValue !== null) {
    return {
      min: singleValue,
      max: singleValue,
    }
  }

  const matched = normalized.match(/^(\d+)-(\d+)$/)
  if (!matched) {
    return null
  }

  const minValue = tryParseNonNegativeSafeInteger(matched[1])
  const maxValue = tryParseNonNegativeSafeInteger(matched[2])
  if (minValue === null || maxValue === null) {
    return null
  }

  return {
    min: Math.min(minValue, maxValue),
    max: Math.max(minValue, maxValue),
  }
}

export function formatTaskRewardRange(range: TaskRewardRange) {
  const normalized = normalizeTaskRewardRange(range)
  return normalized.min === normalized.max
    ? formatNumber(normalized.min)
    : `${formatNumber(normalized.min)}-${formatNumber(normalized.max)}`
}

export function rollTaskReward(range: TaskRewardRange, random = Math.random) {
  const normalized = normalizeTaskRewardRange(range)
  if (normalized.min === normalized.max) {
    return normalized.min
  }

  return Math.floor(random() * (normalized.max - normalized.min + 1)) + normalized.min
}

export function resolveUserTaskRewardTier(source: VipStateSource | null | undefined): TaskRewardTier {
  if (!isVipActive(source)) {
    return TaskRewardTier.NORMAL
  }

  const vipLevel = getVipLevel(source)
  if (vipLevel >= 3) {
    return TaskRewardTier.VIP3
  }

  if (vipLevel === 2) {
    return TaskRewardTier.VIP2
  }

  return TaskRewardTier.VIP1
}

export function getTaskRewardRangeForTier(
  settings: TieredTaskRewardSettings,
  tier: TaskRewardTier,
) {
  switch (tier) {
    case TaskRewardTier.VIP3:
      return settings.vip3
    case TaskRewardTier.VIP2:
      return settings.vip2
    case TaskRewardTier.VIP1:
      return settings.vip1
    default:
      return settings.normal
  }
}

export function resolveUserTaskRewardRange(
  settings: TieredTaskRewardSettings,
  source: VipStateSource | null | undefined,
) {
  const tier = resolveUserTaskRewardTier(source)
  return { tier, range: getTaskRewardRangeForTier(settings, tier) }
}
