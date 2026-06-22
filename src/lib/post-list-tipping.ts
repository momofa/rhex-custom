import { getPostTipSummary, type PostTipSummary } from "@/lib/post-tips"
import {
  normalizePostListDisplayMode,
  POST_LIST_DISPLAY_MODE_WEIBO,
  type PostListDisplayMode,
} from "@/lib/post-list-display"

export type PostListTipSummary = {
  enabled: boolean
  isLoggedIn: boolean
  pointName: string
  currentUserPoints: number
  gifts: PostTipSummary["gifts"]
  giftStats: PostTipSummary["giftStats"]
  recentGiftEvents: PostTipSummary["recentGiftEvents"]
  allowedAmounts: number[]
  dailyLimit: number
  perPostLimit: number
  usedDailyCount: number
  usedPostCount: number
  totalCount: number
  totalPoints: number
  topSupporters: PostTipSummary["topSupporters"]
}

export function mapPostTipSummaryToListTipSummary(summary: PostTipSummary): PostListTipSummary {
  return {
    enabled: summary.enabled,
    isLoggedIn: summary.isLoggedIn,
    pointName: summary.pointName,
    currentUserPoints: summary.currentUserPoints,
    gifts: summary.gifts,
    giftStats: summary.giftStats,
    recentGiftEvents: summary.recentGiftEvents,
    allowedAmounts: summary.allowedAmounts,
    dailyLimit: summary.dailyLimit,
    perPostLimit: summary.perPostLimit,
    usedDailyCount: summary.usedDailyCount,
    usedPostCount: summary.usedPostCount,
    totalCount: summary.tipCount,
    totalPoints: summary.tipTotalPoints,
    topSupporters: summary.topSupporters,
  }
}

export function shouldAttachPostListTipSummaries(listDisplayMode?: PostListDisplayMode | null): boolean {
  return normalizePostListDisplayMode(listDisplayMode) === POST_LIST_DISPLAY_MODE_WEIBO
}

export async function attachPostListTipSummaries<T extends { id: string }>(
  items: T[],
  currentUserId?: number,
): Promise<Array<T & { tipping?: PostListTipSummary }>> {
  if (items.length === 0) {
    return items
  }

  const summaries = await Promise.all(
    items.map((item) => getPostTipSummary(item.id, currentUserId)),
  )

  return items.map((item, index) => ({
    ...item,
    tipping: mapPostTipSummaryToListTipSummary(summaries[index]!),
  }))
}
