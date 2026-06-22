import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Award, Medal, TrendingUp, Trophy, type LucideIcon } from "lucide-react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/user/user-avatar"
import { formatCompactNumber, formatNumber } from "@/lib/formatters"
import type { getLeaderboardPageChromeData } from "@/lib/leaderboard-page-chrome"
import { getPublicUidLabel } from "@/lib/user-presentation"
import { cn } from "@/lib/utils"

interface LeaderboardShellEntry {
  userId: number
  publicUid?: string | null
  username: string
  displayName: string
  avatarPath: string | null
  rank: number
}

interface LeaderboardTabItem {
  href: string
  label: string
  active?: boolean
}

interface LeaderboardPageShellProps<TEntry extends LeaderboardShellEntry> {
  eyebrow: string
  title: string
  description: string
  totalUsers: number
  entries: TEntry[]
  currentUserEntry: TEntry | null
  currentUserHint: string
  emptyText: string
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  scoreColumnLabel: string
  tabs: LeaderboardTabItem[]
  chrome: Awaited<ReturnType<typeof getLeaderboardPageChromeData>>
  renderMetric: (entry: TEntry) => ReactNode
  renderMetricValue: (entry: TEntry) => string
  renderMeta?: (entry: TEntry) => ReactNode
}

function renderRankLabel(rank: number) {
  if (rank === 1) {
    return "01"
  }

  if (rank === 2) {
    return "02"
  }

  if (rank === 3) {
    return "03"
  }

  return String(rank).padStart(2, "0")
}

function getTopRankVisual(rank: number): { Icon: LucideIcon; badgeClassName: string; iconClassName: string } | null {
  if (rank === 1) {
    return {
      Icon: Trophy,
      badgeClassName: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-100",
      iconClassName: "text-amber-500",
    }
  }

  if (rank === 2) {
    return {
      Icon: Medal,
      badgeClassName: "bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-100",
      iconClassName: "text-slate-500 dark:text-slate-200",
    }
  }

  if (rank === 3) {
    return {
      Icon: Award,
      badgeClassName: "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-100",
      iconClassName: "text-orange-500",
    }
  }

  return null
}

function CurrentRankSidebarCard<TEntry extends LeaderboardShellEntry>({
  currentUserEntry,
  currentUserHint,
  scoreColumnLabel,
  renderMetric,
  renderMetricValue,
  renderMeta,
}: {
  currentUserEntry: TEntry | null
  currentUserHint: string
  scoreColumnLabel: string
  renderMetric: (entry: TEntry) => ReactNode
  renderMetricValue: (entry: TEntry) => string
  renderMeta?: (entry: TEntry) => ReactNode
}) {
  return (
    <Card className="overflow-hidden border-border/80 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.95))] shadow-xs dark:bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(15,23,42,0.96))]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-amber-500" />
          我的排名
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentUserEntry ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-sm font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-100">
                #{currentUserEntry.rank}
              </div>
              <UserAvatar name={currentUserEntry.displayName} avatarPath={currentUserEntry.avatarPath} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{currentUserEntry.displayName}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>论坛第 {getPublicUidLabel(currentUserEntry)} 号会员</span>
                  {renderMeta ? renderMeta(currentUserEntry) : null}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{scoreColumnLabel}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-lg font-semibold text-emerald-600">{renderMetricValue(currentUserEntry)}</p>
                <div className="text-right text-xs text-muted-foreground">
                  {renderMetric(currentUserEntry)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">{currentUserHint}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function LeaderboardPageShell<TEntry extends LeaderboardShellEntry>({
  eyebrow,
  title,
  description,
  totalUsers,
  entries,
  currentUserEntry,
  currentUserHint,
  emptyText,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  scoreColumnLabel,
  tabs,
  chrome,
  renderMetric,
  renderMetricValue,
  renderMeta,
}: LeaderboardPageShellProps<TEntry>) {
  const topPanels = [
    {
      id: "leaderboard-current-rank",
      slot: "home-right-top" as const,
      order: -100,
      content: (
        <CurrentRankSidebarCard
          currentUserEntry={currentUserEntry}
          currentUserHint={currentUserHint}
          scoreColumnLabel={scoreColumnLabel}
          renderMetric={renderMetric}
          renderMetricValue={renderMetricValue}
          renderMeta={renderMeta}
        />
      ),
    },
  ]
  const leaderboardSlotProps = {
    title,
    totalUsers,
    entryCount: entries.length,
    currentUserRank: currentUserEntry?.rank ?? null,
    activeTabHref: tabs.find((tab) => tab.active)?.href ?? null,
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="leaderboard.page.before" props={leaderboardSlotProps} />
        <AddonSurfaceRenderer surface="leaderboard.page" props={{ ...leaderboardSlotProps, entries }}>
          <ForumPageShell
            zones={chrome.zones}
            boards={chrome.boards}
            main={(
              <main className="mt-6 py-1 pb-12">
                <div className="space-y-5">
                <AddonSlotRenderer slot="leaderboard.hero.before" props={leaderboardSlotProps} />
                <AddonSurfaceRenderer surface="leaderboard.hero" props={leaderboardSlotProps}>
                  <section className="overflow-hidden rounded-xl border border-border">
                    <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 md:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{eyebrow}</p>
                          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
                        </div>
                
                      </div>

                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          {tabs.map((tab) => (
                            <Link
                              key={tab.href}
                              href={tab.href}
                              className={tab.active
                                ? "inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
                                : "inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground"}
                            >
                              {tab.label}
                            </Link>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <Link href={primaryHref} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground">
                            {primaryLabel}
                          </Link>
                          {secondaryHref && secondaryLabel ? (
                            <Link href={secondaryHref} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground">
                              {secondaryLabel}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </section>
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="leaderboard.hero.after" props={leaderboardSlotProps} />

                <AddonSlotRenderer slot="leaderboard.content.before" props={leaderboardSlotProps} />
                <AddonSurfaceRenderer surface="leaderboard.content" props={{ ...leaderboardSlotProps, entries }}>
                  <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                    <div className="grid grid-cols-[70px_minmax(0,1fr)_132px] items-center gap-3 border-b border-border bg-muted/25 px-4 py-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      <span>排名</span>
                      <span>用户</span>
                      <span className="text-right">{scoreColumnLabel}</span>
                    </div>

                    {entries.length === 0 ? (
                      <div className="px-4 py-10 text-sm text-muted-foreground">{emptyText}</div>
                    ) : null}

                    {entries.map((entry) => {
                      const isCurrentUser = currentUserEntry?.userId === entry.userId
                      const isTopThree = entry.rank <= 3
                      const topRankVisual = getTopRankVisual(entry.rank)

                      return (
                        <Link
                          key={`leaderboard-row-${entry.userId}`}
                          href={`/users/${entry.username}`}
                          className={isCurrentUser
                            ? "grid grid-cols-[70px_minmax(0,1fr)_132px] items-center gap-3 border-b border-border/80 bg-amber-50/50 px-4 py-2.5 transition-colors hover:bg-amber-50 dark:bg-amber-400/10 dark:hover:bg-amber-400/15"
                            : "grid grid-cols-[70px_minmax(0,1fr)_132px] items-center gap-3 border-b border-border/70 px-4 py-2.5 transition-colors hover:bg-accent/35"}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold",
                              isTopThree && topRankVisual
                                ? topRankVisual.badgeClassName
                                : "bg-secondary text-muted-foreground",
                            )}>
                              {renderRankLabel(entry.rank)}
                            </span>
                            {isTopThree && topRankVisual ? <topRankVisual.Icon className={cn("h-3.5 w-3.5", topRankVisual.iconClassName)} /> : null}
                          </div>

                          <div className="flex min-w-0 items-center gap-3">
                            <UserAvatar name={entry.displayName} avatarPath={entry.avatarPath} size="xs" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">{entry.displayName}</p>
                                {isCurrentUser ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-400/15 dark:text-amber-100">我</span> : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span>论坛第 {getPublicUidLabel(entry)} 号会员</span>
                                {renderMeta ? renderMeta(entry) : null}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-600">{renderMetricValue(entry)}</p>
                            <div className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{renderMetric(entry)}</div>
                          </div>
                        </Link>
                      )
                    })}

                    {entries.length > 0 ? (
                      <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
                        <span>榜单按实时数据排序，刷新页面可查看最新结果。</span>
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span title={`已展示 ${formatNumber(entries.length)} 名`}>已展示 {formatCompactNumber(entries.length)} 名</span>
                        </span>
                      </div>
                    ) : null}
                  </section>
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="leaderboard.content.after" props={leaderboardSlotProps} />
                </div>
              </main>
            )}
            rightSidebar={(
              <aside className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="leaderboard.sidebar.before" props={leaderboardSlotProps} />
              <AddonSurfaceRenderer surface="leaderboard.sidebar" props={leaderboardSlotProps}>
                <HomeSidebarPanels
                  user={chrome.sidebarUser}
                  hotTopics={chrome.hotTopics}
                  announcements={chrome.announcements}
                  showAnnouncements={chrome.settings.homeSidebarAnnouncementsEnabled}
                  siteName={chrome.settings.siteName}
                  siteDescription={chrome.settings.siteDescription}
                  siteLogoPath={chrome.settings.siteLogoPath}
                  siteIconPath={chrome.settings.siteIconPath}
                  topPanels={topPanels}
                />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="leaderboard.sidebar.after" props={leaderboardSlotProps} />
              </aside>
            )}
          />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="leaderboard.page.after" props={leaderboardSlotProps} />
      </div>
    </div>
  )
}
