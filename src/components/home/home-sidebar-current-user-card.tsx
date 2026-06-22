"use client"

import { useCurrentUser } from "@/components/current-user-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarUserCard, type SidebarUserCardData } from "@/components/user/sidebar-user-card"
import type { SiteSettingsData } from "@/lib/site-settings.types"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

interface HomeSidebarCurrentUserCardProps {
  createPostHref?: string
  settings: Pick<
    SiteSettingsData,
    | "siteName"
    | "siteDescription"
    | "siteLogoPath"
    | "siteIconPath"
    | "pointName"
    | "checkInEnabled"
    | "checkInReward"
    | "checkInRewardText"
    | "checkInVip1Reward"
    | "checkInVip1RewardText"
    | "checkInVip2Reward"
    | "checkInVip2RewardText"
    | "checkInVip3Reward"
    | "checkInVip3RewardText"
    | "checkInMakeUpEnabled"
    | "checkInMakeUpCardPrice"
    | "checkInVipMakeUpCardPrice"
    | "checkInVip1MakeUpCardPrice"
    | "checkInVip2MakeUpCardPrice"
    | "checkInVip3MakeUpCardPrice"
    | "checkInMakeUpCountsTowardStreak"
    | "checkInMakeUpOldestDayLimit"
  >
}

function resolveCheckInReward(user: NonNullable<ReturnType<typeof useCurrentUser>["user"]>, settings: HomeSidebarCurrentUserCardProps["settings"]) {
  if (!isVipActive(user)) {
    return {
      reward: settings.checkInReward,
      rewardText: settings.checkInRewardText,
    }
  }

  const vipLevel = getVipLevel(user)
  if (vipLevel >= 3) {
    return {
      reward: settings.checkInVip3Reward,
      rewardText: settings.checkInVip3RewardText,
    }
  }

  if (vipLevel === 2) {
    return {
      reward: settings.checkInVip2Reward,
      rewardText: settings.checkInVip2RewardText,
    }
  }

  return {
    reward: settings.checkInVip1Reward,
    rewardText: settings.checkInVip1RewardText,
  }
}

function HomeSidebarCurrentUserCardSkeleton() {
  return (
    <div
      className="mobile-sidebar-section overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5 dark:shadow-black/30"
      aria-busy="true"
      aria-label="正在加载用户信息"
    >
      <div className="sidebar-user-card-header p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 pt-0.5">
              <Skeleton className="h-4 w-24 rounded-full" />
              <div className="mt-2 flex items-center gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>
      <div className="p-4 pt-0">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function HomeSidebarCurrentUserCard({ createPostHref, settings }: HomeSidebarCurrentUserCardProps) {
  const { user, surface, loading } = useCurrentUser()
  const reward = user ? resolveCheckInReward(user, settings) : null
  const sidebarUser: SidebarUserCardData | null = user
    ? {
        username: user.username,
        nickname: user.nickname,
        displayName: user.displayName,
        avatarPath: user.avatarPath,
        role: user.role === "ADMIN" || user.role === "MODERATOR" ? user.role : "USER",
        roleBadge: user.roleBadge,
        status: user.status === "ACTIVE" || user.status === "MUTED" || user.status === "BANNED" || user.status === "INACTIVE" ? user.status : "ACTIVE",
        level: Math.max(1, user.levelBadgeLevel ?? user.level ?? 1),
        levelName: user.levelName ?? undefined,
        levelColor: user.levelColor ?? undefined,
        levelIcon: user.levelIcon ?? undefined,
        vipLevel: user.vipLevel ?? 0,
        vipExpiresAt: user.vipExpiresAt,
        boardCount: surface?.boardCount ?? 0,
        favoriteCount: surface?.favoriteCount ?? 0,
        followerCount: surface?.followerCount ?? 0,
        postCount: surface?.postCount ?? 0,
        receivedLikeCount: surface?.receivedLikeCount ?? 0,
        points: surface?.points ?? user.points ?? 0,
        pointName: settings.pointName,
        checkInEnabled: settings.checkInEnabled,
        checkInReward: reward?.reward,
        checkInRewardText: reward?.rewardText,
        checkInMakeUpEnabled: settings.checkInMakeUpEnabled,
        checkInMakeUpCardPrice: settings.checkInMakeUpCardPrice,
        checkInVipMakeUpCardPrice: settings.checkInVipMakeUpCardPrice,
        checkInVip1MakeUpCardPrice: settings.checkInVip1MakeUpCardPrice,
        checkInVip2MakeUpCardPrice: settings.checkInVip2MakeUpCardPrice,
        checkInVip3MakeUpCardPrice: settings.checkInVip3MakeUpCardPrice,
        checkInMakeUpCountsTowardStreak: settings.checkInMakeUpCountsTowardStreak,
        checkInMakeUpOldestDayLimit: settings.checkInMakeUpOldestDayLimit,
        checkedInToday: surface?.checkedInToday ?? false,
        currentCheckInStreak: surface?.currentCheckInStreak ?? 0,
        maxCheckInStreak: surface?.maxCheckInStreak ?? 0,
      }
    : null

  if (loading && !user) {
    return <HomeSidebarCurrentUserCardSkeleton />
  }

  return (
    <SidebarUserCard
      user={sidebarUser}
      createPostHref={createPostHref}
      siteName={settings.siteName}
      siteDescription={settings.siteDescription}
      siteLogoPath={settings.siteLogoPath}
      siteIconPath={settings.siteIconPath}
    />
  )
}
