import type { BadgeEligibilitySnapshot } from "@/lib/badges"
import { formatCompactNumber, formatCompactPointValue } from "@/lib/formatters"
import type { SiteUserProfile } from "@/lib/users"

export interface UserProfileRadarDimension {
  key: "wealth" | "experience" | "diligence" | "skill" | "charm" | "activity"
  label: string
  score: number
  displayScore: number
  detail: string
}

export interface UserProfileRadarData {
  dimensions: UserProfileRadarDimension[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLog(value: number, reference: number) {
  const safeValue = Math.max(0, value)
  const safeReference = Math.max(1, reference)
  return clamp(Math.log1p(safeValue) / Math.log1p(safeReference), 0, 1)
}

function normalizeLinear(value: number, reference: number) {
  const safeValue = Math.max(0, value)
  const safeReference = Math.max(1, reference)
  return clamp(safeValue / safeReference, 0, 1)
}

function combineScore(items: Array<{ normalized: number; weight: number }>) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)

  if (totalWeight <= 0) {
    return 0
  }

  const weightedValue = items.reduce((sum, item) => sum + (item.normalized * item.weight), 0) / totalWeight
  return clamp(Math.round(weightedValue * 100) / 10, 0, 10)
}

function formatShortCount(value: number) {
  return formatCompactNumber(Math.max(0, Math.trunc(value)))
}

function getRegisterDays(createdAt: string) {
  const createdAtDate = new Date(createdAt)

  if (Number.isNaN(createdAtDate.getTime())) {
    return 0
  }

  return Math.max(0, Math.floor((Date.now() - createdAtDate.getTime()) / 86_400_000))
}

export function buildUserProfileRadarData(params: {
  user: SiteUserProfile
  snapshot: BadgeEligibilitySnapshot | null
}): UserProfileRadarData {
  const { user, snapshot } = params
  const registerDays = snapshot?.registerDays ?? getRegisterDays(user.createdAt)
  const level = snapshot?.level ?? user.level
  const points = snapshot?.points ?? user.points
  const vipLevel = snapshot?.vipLevel ?? Math.max(0, user.vipLevel ?? 0)
  const boardCount = user.boardCount ?? 0
  const checkInDays = snapshot?.checkInDays ?? 0
  const maxCheckInStreak = snapshot?.maxCheckInStreak ?? 0
  const acceptedAnswerCount = snapshot?.acceptedAnswerCount ?? 0
  const receivedTipCount = snapshot?.receivedTipCount ?? 0
  const likeReceivedCount = snapshot?.receivedLikeCount ?? user.likeReceivedCount
  const followerCount = snapshot?.followerCount ?? user.followerCount
  const postCount = snapshot?.postCount ?? user.postCount
  const commentCount = snapshot?.commentCount ?? user.commentCount

  const dimensions: UserProfileRadarDimension[] = [
    {
      key: "wealth",
      label: "财富",
      score: combineScore([
        { normalized: normalizeLog(points, 8_000), weight: 0.8 },
        { normalized: normalizeLinear(vipLevel, 3), weight: 0.2 },
      ]),
      displayScore: 0,
      detail: `积分 ${formatCompactPointValue(points)} · VIP ${vipLevel}`,
    },
    {
      key: "experience",
      label: "阅历",
      score: combineScore([
        { normalized: normalizeLog(registerDays, 720), weight: 0.45 },
        { normalized: normalizeLinear(level, 10), weight: 0.35 },
        { normalized: normalizeLinear(boardCount, 20), weight: 0.2 },
      ]),
      displayScore: 0,
      detail: `等级 ${formatShortCount(level)} · 注册 ${formatShortCount(registerDays)} 天`,
    },
    {
      key: "diligence",
      label: "勤勉",
      score: combineScore([
        { normalized: normalizeLog(checkInDays, 240), weight: 0.65 },
        { normalized: normalizeLog(maxCheckInStreak, 45), weight: 0.35 },
      ]),
      displayScore: 0,
      detail: `签到 ${formatShortCount(checkInDays)} 天 · 连续 ${formatShortCount(maxCheckInStreak)} 天`,
    },
    {
      key: "skill",
      label: "技艺",
      score: combineScore([
        { normalized: normalizeLog(acceptedAnswerCount, 24), weight: 0.7 },
        { normalized: normalizeLog(receivedTipCount, 50), weight: 0.3 },
      ]),
      displayScore: 0,
      detail: `采纳 ${formatShortCount(acceptedAnswerCount)} · 被打赏 ${formatShortCount(receivedTipCount)}`,
    },
    {
      key: "charm",
      label: "魅力",
      score: combineScore([
        { normalized: normalizeLog(likeReceivedCount, 600), weight: 0.7 },
        { normalized: normalizeLog(followerCount, 120), weight: 0.3 },
      ]),
      displayScore: 0,
      detail: `获赞 ${formatShortCount(likeReceivedCount)} · 粉丝 ${formatShortCount(followerCount)}`,
    },
    {
      key: "activity",
      label: "活跃",
      score: combineScore([
        { normalized: normalizeLog(postCount, 80), weight: 0.4 },
        { normalized: normalizeLog(commentCount, 240), weight: 0.6 },
      ]),
      displayScore: 0,
      detail: `帖子 ${formatShortCount(postCount)} · 回复 ${formatShortCount(commentCount)}`,
    },
  ]

  return {
    dimensions: dimensions.map((dimension) => ({
      ...dimension,
      displayScore: Math.round(dimension.score),
    })),
  }
}
