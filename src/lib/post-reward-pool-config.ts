export type PostRewardPoolMode = "RED_PACKET" | "JACKPOT"
export type PostRewardPoolGrantMode = "FIXED" | "RANDOM"
export type PostRewardPoolClaimOrderMode = "FIRST_COME_FIRST_SERVED" | "RANDOM"
export type PostRewardPoolTriggerType = "REPLY" | "LIKE" | "FAVORITE"

export interface StoredRedPacketRewardPoolConfig {
  enabled: true
  mode: "RED_PACKET"
  grantMode: PostRewardPoolGrantMode
  claimOrderMode: PostRewardPoolClaimOrderMode
  triggerType: PostRewardPoolTriggerType
  totalPoints: number
  unitPoints: number
  packetCount: number
}

export interface StoredJackpotRewardPoolConfig {
  enabled: true
  mode: "JACKPOT"
  triggerType: "REPLY"
  initialPoints: number
  replyIncrementPoints: number
  hitProbability: number
}

export type StoredPostRewardPoolConfig =
  | StoredRedPacketRewardPoolConfig
  | StoredJackpotRewardPoolConfig

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function toPositiveInteger(value: unknown) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export function toProbabilityPercent(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(1, Math.min(100, Math.floor(parsed)))
}

export function isPostRewardPoolMode(value: unknown): value is PostRewardPoolMode {
  return value === "RED_PACKET" || value === "JACKPOT"
}

export function getPostRewardPoolModeLabel(mode: PostRewardPoolMode) {
  return mode === "JACKPOT" ? "聚宝盆" : "帖子红包"
}

export function parseStoredPostRewardPoolConfig(value: unknown): StoredPostRewardPoolConfig | null {
  if (!isRecord(value) || value.enabled !== true || !isPostRewardPoolMode(value.mode)) {
    return null
  }

  if (value.mode === "JACKPOT") {
    const initialPoints = toPositiveInteger(value.initialPoints)
    const replyIncrementPoints = toPositiveInteger(value.replyIncrementPoints)

    if (!initialPoints || !replyIncrementPoints) {
      return null
    }

    return {
      enabled: true,
      mode: "JACKPOT",
      triggerType: "REPLY",
      initialPoints,
      replyIncrementPoints,
      hitProbability: toProbabilityPercent(value.hitProbability, 15),
    }
  }

  const totalPoints = toPositiveInteger(value.totalPoints)
  const unitPoints = toPositiveInteger(value.unitPoints ?? value.totalPoints)
  const packetCount = toPositiveInteger(value.packetCount)
  const grantMode = value.grantMode === "RANDOM" ? "RANDOM" : "FIXED"
  const claimOrderMode = value.claimOrderMode === "RANDOM" ? "RANDOM" : "FIRST_COME_FIRST_SERVED"
  const triggerType = value.triggerType === "LIKE" || value.triggerType === "FAVORITE" ? value.triggerType : "REPLY"

  if (!totalPoints || !unitPoints || !packetCount) {
    return null
  }

  return {
    enabled: true,
    mode: "RED_PACKET",
    grantMode,
    claimOrderMode,
    triggerType,
    totalPoints,
    unitPoints,
    packetCount,
  }
}
