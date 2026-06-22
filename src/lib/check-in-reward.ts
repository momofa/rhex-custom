import { formatNumber } from "@/lib/formatters"
import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"
import { getVipLevel, isVipActive, type VipStateSource } from "@/lib/vip-status"

export interface CheckInRewardRange {
  min: number
  max: number
}

export interface CheckInRewardSettings {
  normal: CheckInRewardRange
  vip1: CheckInRewardRange
  vip2: CheckInRewardRange
  vip3: CheckInRewardRange
}

function tryParseNonNegativeSafeInteger(value: unknown) {
  try {
    return parseNonNegativeSafeInteger(value)
  } catch {
    return null
  }
}

function normalizeCheckInRewardBound(value: unknown, fallback: number) {
  return tryParseNonNegativeSafeInteger(value) ?? fallback
}

export function normalizeCheckInRewardRange(
  value: Partial<CheckInRewardRange> | null | undefined,
  fallback: CheckInRewardRange = { min: 0, max: 0 },
): CheckInRewardRange {
  const minValue = normalizeCheckInRewardBound(value?.min, normalizeCheckInRewardBound(fallback.min, 0))
  const maxValue = normalizeCheckInRewardBound(value?.max, normalizeCheckInRewardBound(fallback.max, minValue))

  return {
    min: Math.min(minValue, maxValue),
    max: Math.max(minValue, maxValue),
  }
}

export function parseCheckInRewardRangeInput(value: unknown): CheckInRewardRange | null {
  if (typeof value === "number") {
    const normalized = parseNonNegativeSafeInteger(value)
    return normalized === null
      ? null
      : { min: normalized, max: normalized }
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

export function formatCheckInRewardRange(range: CheckInRewardRange) {
  const normalized = normalizeCheckInRewardRange(range)
  return normalized.min === normalized.max
    ? formatNumber(normalized.min)
    : `${formatNumber(normalized.min)}-${formatNumber(normalized.max)}`
}

export function rollCheckInReward(range: CheckInRewardRange, random = Math.random) {
  const normalized = normalizeCheckInRewardRange(range)
  if (normalized.min === normalized.max) {
    return normalized.min
  }

  return Math.floor(random() * (normalized.max - normalized.min + 1)) + normalized.min
}

export function resolveUserCheckInRewardRange(
  settings: CheckInRewardSettings,
  source: VipStateSource | null | undefined,
) {
  if (!isVipActive(source)) {
    return settings.normal
  }

  const vipLevel = getVipLevel(source)
  if (vipLevel >= 3) {
    return settings.vip3
  }

  if (vipLevel === 2) {
    return settings.vip2
  }

  return settings.vip1
}
