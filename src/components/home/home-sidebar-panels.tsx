import Link from "next/link"
import { Flame, Link2 } from "lucide-react"
import type { ComponentProps } from "react"

import { HomeAnnouncementPanel } from "@/components/home/home-announcement-panel"
import { HomeSidebarCurrentUserCard } from "@/components/home/home-sidebar-current-user-card"
import { HomeSidebarCurrentUserReadingHistory } from "@/components/home/home-sidebar-current-user-reading-history"
import { PostListLink } from "@/components/post/post-list-link"
import { ReadingHistoryPanel } from "@/components/post/reading-history-panel"
import { HomeSiteStatsCard } from "@/components/home/home-site-stats-card"
import { SidebarUserCard, type SidebarUserCardData } from "@/components/user/sidebar-user-card"
import { getSelfServeAdsSidebarPanel, type SelfServeAdsSidebarSurface } from "@/components/self-serve-ads-sidebar-panel"
import { UserAvatar } from "@/components/user/user-avatar"
import type { AnnouncementItem } from "@/lib/announcements"
import type { FriendLinkItem } from "@/lib/friend-links"
import { groupHomeSidebarPanels, type HomeSidebarPanelItem } from "@/lib/home-sidebar-layout"
import type { HomeSidebarStatsData } from "@/lib/home-sidebar-stats"
import { getPostPath } from "@/lib/post-links"
import type { SiteSettingsData } from "@/lib/site-settings.types"
import { cn } from "@/lib/utils"
import { AddonSlotRenderer } from "@/addons-host"

interface HotTopicItem {
  id: string
  slug: string
  title: string
  lastReplyAuthorName: string | null
  lastRepliedAt: string
  authorName: string
  authorAvatarPath?: string | null
}

interface HomeSidebarPanelsProps {
  user: SidebarUserCardData | null
  hotTopics: HotTopicItem[]
  postLinkDisplayMode?: "SLUG" | "ID"
  announcements?: AnnouncementItem[]
  showAnnouncements?: boolean
  friendLinks?: FriendLinkItem[]
  friendLinksEnabled?: boolean
  createPostHref?: string
  topPanels?: HomeSidebarPanelItem[]
  middlePanels?: HomeSidebarPanelItem[]
  bottomPanels?: HomeSidebarPanelItem[]
  stats?: HomeSidebarStatsData | null
  siteName?: string
  siteDescription?: string
  siteLogoPath?: string | null
  siteIconPath?: string | null
  currentUserSettings?: ComponentProps<typeof HomeSidebarCurrentUserCard>["settings"]
  stickyTopClass?: string
  sticky?: boolean
  selfServeAdsSurface?: SelfServeAdsSidebarSurface | false
}

export function buildHomeSidebarCurrentUserSettings(settings: SiteSettingsData): HomeSidebarPanelsProps["currentUserSettings"] {
  return {
    siteName: settings.siteName,
    siteDescription: settings.siteDescription,
    siteLogoPath: settings.siteLogoPath,
    siteIconPath: settings.siteIconPath,
    pointName: settings.pointName,
    checkInEnabled: settings.checkInEnabled,
    checkInReward: settings.checkInReward,
    checkInRewardText: settings.checkInRewardText,
    checkInVip1Reward: settings.checkInVip1Reward,
    checkInVip1RewardText: settings.checkInVip1RewardText,
    checkInVip2Reward: settings.checkInVip2Reward,
    checkInVip2RewardText: settings.checkInVip2RewardText,
    checkInVip3Reward: settings.checkInVip3Reward,
    checkInVip3RewardText: settings.checkInVip3RewardText,
    checkInMakeUpEnabled: settings.checkInMakeUpEnabled,
    checkInMakeUpCardPrice: settings.checkInMakeUpCardPrice,
    checkInVipMakeUpCardPrice: settings.checkInVipMakeUpCardPrice,
    checkInVip1MakeUpCardPrice: settings.checkInVip1MakeUpCardPrice,
    checkInVip2MakeUpCardPrice: settings.checkInVip2MakeUpCardPrice,
    checkInVip3MakeUpCardPrice: settings.checkInVip3MakeUpCardPrice,
    checkInMakeUpCountsTowardStreak: settings.checkInMakeUpCountsTowardStreak,
    checkInMakeUpOldestDayLimit: settings.checkInMakeUpOldestDayLimit,
  }
}

export async function HomeSidebarPanels({ user, hotTopics, postLinkDisplayMode = "SLUG", announcements = [], showAnnouncements = true, friendLinks = [], friendLinksEnabled = false, createPostHref, topPanels = [], middlePanels = [], bottomPanels = [], stats = null, siteName, siteDescription, siteLogoPath, siteIconPath, currentUserSettings, stickyTopClass = "top-20", sticky = true, selfServeAdsSurface = "global" }: HomeSidebarPanelsProps) {
  const selfServeAdsPanel = selfServeAdsSurface ? await getSelfServeAdsSidebarPanel(selfServeAdsSurface) : null
  const sidebarPanels = groupHomeSidebarPanels([
    ...topPanels,
    ...middlePanels,
    ...bottomPanels,
    ...(selfServeAdsPanel ? [selfServeAdsPanel] : []),
  ])

  return (
    <div className={cn("home-sidebar-panels mobile-sidebar-stack flex min-w-0 w-full max-w-full flex-col gap-4", sticky && "sticky", sticky && stickyTopClass)}>
      {currentUserSettings ? (
        <HomeSidebarCurrentUserCard createPostHref={createPostHref} settings={currentUserSettings} />
      ) : (
        <SidebarUserCard user={user} createPostHref={createPostHref} siteName={siteName} siteDescription={siteDescription} siteLogoPath={siteLogoPath} siteIconPath={siteIconPath} />
      )}


      <AddonSlotRenderer slot="home.right.top" />
      {sidebarPanels.top.map((panel) => <div key={panel.id}>{panel.content}</div>)}

      {showAnnouncements ? <HomeAnnouncementPanel announcements={announcements} /> : null}

      <div className="mobile-sidebar-section rounded-xl border border-border bg-card p-3 shadow-xs shadow-black/5 dark:shadow-black/30">
        <div className="mb-3 flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-orange-500 dark:text-orange-400" />
          <h3 className="text-sm font-semibold">今日热帖</h3>
        </div>
        <div className="flex flex-col gap-1.5">
          {hotTopics.map((topic) => {
            const postPath = getPostPath({ id: topic.id, slug: topic.slug }, { mode: postLinkDisplayMode })

            return (
            <PostListLink key={topic.id} href={postPath} visitedPath={postPath} dimWhenRead className="-mx-1 flex items-start gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-accent/70">
              <UserAvatar name={topic.authorName} avatarPath={topic.authorAvatarPath} size="xs" />
              <div className="min-w-0 flex-1">
                <div title={topic.title} className="truncate text-[0.9rem] leading-5">{topic.title}</div>
                <div className="mt-0.5 text-[0.733rem] leading-4 text-muted-foreground">最后回复：{topic.lastReplyAuthorName ?? topic.authorName} · {topic.lastRepliedAt}</div>
              </div>
            </PostListLink>
          )})}
        </div>
      </div>


      <AddonSlotRenderer slot="home.right.middle" />
      {sidebarPanels.middle.map((panel) => <div key={panel.id}>{panel.content}</div>)}

      {friendLinksEnabled ? (

        <section className="mobile-sidebar-section rounded-xl border border-border bg-card p-4 shadow-xs shadow-black/5 dark:shadow-black/30">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-sky-500" />
              <div>
                <h3 className="font-semibold">友情链接</h3>
              </div>
            </div>
            <Link href="/link" className="text-xs text-muted-foreground transition hover:text-foreground">全部链接</Link>
          </div>
          {friendLinks.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {friendLinks.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="truncate rounded-lg px-2 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" title={link.name}>
                  {link.name}
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-border px-3 py-4 text-xs leading-6 text-muted-foreground">
              当前还没有已通过的友情链接，审核通过后会显示在这里。
            </div>
          )}
        </section>
      ) : null}

      <AddonSlotRenderer slot="home.right.bottom" />
      {sidebarPanels.bottom.map((panel) => <div key={panel.id}>{panel.content}</div>)}

      {stats ? <HomeSiteStatsCard stats={stats} /> : null}

            {currentUserSettings ? (
              <HomeSidebarCurrentUserReadingHistory />
            ) : user ? (
              <ReadingHistoryPanel variant="sidebar" title="近期访问" limit={5} moreHref="/settings?tab=follows&followTab=history" showOnlyToday requireLoggedIn isLoggedIn hideWhenEmpty stabilizeLayoutOnHydration />
            ) : null}
    </div>
  )
}
