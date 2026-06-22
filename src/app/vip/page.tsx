import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Crown, ShieldCheck, Sparkles, TicketCheck } from "lucide-react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { buildHomeSidebarCurrentUserSettings, HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/rbutton"
import { VipActionPanel } from "@/components/vip/vip-action-panel"
import { VipBadge } from "@/components/vip/vip-badge"
import { VipLevelIcon } from "@/components/vip/vip-level-icon"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { buildLoginHrefWithRedirect } from "@/lib/auth-redirect"
import { getBoards } from "@/lib/boards"
import { formatCompactPointValue, formatDateTime } from "@/lib/formatters"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { cn } from "@/lib/utils"
import { getVipLevel, getVipNameClass, isVipActive } from "@/lib/vip-status"
import { getZones } from "@/lib/zones"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `VIP - ${settings.siteName}`,
    description: `查看 ${settings.siteName} 的 VIP 权益、会员等级说明与开通方式。`,
  }
}

function formatPointValue(value: number, pointName: string, suffix: string) {
  return value > 0 ? `${formatCompactPointValue(value)} ${pointName}${suffix}` : `免费${suffix}`
}

const vipMilestones = (settings: Awaited<ReturnType<typeof getSiteSettings>>) => [
  {
    level: 1,
    title: "VIP 1",
    label: "入门通行",
    requirement: `使用 ${formatCompactPointValue(settings.vipMonthlyPrice)} ${settings.pointName} 购买月卡，生效 30 天`,
    privileges: [
      "访问 VIP 专属节点、帖子与回复区域",
      `签到奖励：${settings.checkInVip1RewardText} ${settings.pointName} / 次`,
      `补签价格：${formatPointValue(settings.checkInVip1MakeUpCardPrice, settings.pointName, " / 次")}`,
      `修改昵称：${formatPointValue(settings.nicknameChangeVip1PointCost, settings.pointName, " / 次")}`,
      `购买邀请码：${settings.inviteCodePurchaseEnabled ? formatPointValue(settings.inviteCodeVip1Price, settings.pointName, " / 个") : "未开启"}`,
      `作者下线帖子：${formatPointValue(settings.postOfflineVip1Price, settings.pointName, " / 次")}`,
    ],
  },
  {
    level: 2,
    title: "VIP 2",
    label: "进阶身份",
    requirement: `使用 ${formatCompactPointValue(settings.vipQuarterlyPrice)} ${settings.pointName} 购买季卡，生效 90 天`,
    privileges: [
      "包含 VIP1 全部权益，并可进入更高等级权限节点",
      `签到奖励：${settings.checkInVip2RewardText} ${settings.pointName} / 次`,
      `补签价格：${formatPointValue(settings.checkInVip2MakeUpCardPrice, settings.pointName, " / 次")}`,
      `修改昵称：${formatPointValue(settings.nicknameChangeVip2PointCost, settings.pointName, " / 次")}`,
      `购买邀请码：${settings.inviteCodePurchaseEnabled ? formatPointValue(settings.inviteCodeVip2Price, settings.pointName, " / 个") : "未开启"}`,
      `作者下线帖子：${formatPointValue(settings.postOfflineVip2Price, settings.pointName, " / 次")}`,
    ],
  },
  {
    level: 3,
    title: "VIP 3",
    label: "年度尊享",
    requirement: `使用 ${formatCompactPointValue(settings.vipYearlyPrice)} ${settings.pointName} 购买年卡，生效 365 天`,
    privileges: [
      "包含 VIP1、VIP2 全部权益，并享受最高档位身份能力",
      `签到奖励：${settings.checkInVip3RewardText} ${settings.pointName} / 次`,
      `补签价格：${formatPointValue(settings.checkInVip3MakeUpCardPrice, settings.pointName, " / 次")}`,
      `修改昵称：${formatPointValue(settings.nicknameChangeVip3PointCost, settings.pointName, " / 次")}`,
      `购买邀请码：${settings.inviteCodePurchaseEnabled ? formatPointValue(settings.inviteCodeVip3Price, settings.pointName, " / 个") : "未开启"}`,
      `作者下线帖子：${formatPointValue(settings.postOfflineVip3Price, settings.pointName, " / 次")}`,
    ],
  },
]

const quickBenefits = [
  {
    title: "专属内容",
    icon: ShieldCheck,
  },
  {
    title: "身份标识",
    icon: Crown,
  },
  {
    title: "签到权益",
    icon: TicketCheck,
  },
]

export default async function VipPage() {
  const settingsPromise = getSiteSettings()
  const userPromise = getCurrentUser()
  const [user, settings, boards, zones, hotTopics, announcements] = await Promise.all([
    userPromise,
    settingsPromise,
    getBoards(),
    getZones(),
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3),
  ])
  const vipUser = user
    ? {
        vipLevel: (user as { vipLevel?: number | null }).vipLevel ?? 0,
        vipExpiresAt: (user as { vipExpiresAt?: string | Date | null }).vipExpiresAt ?? null,
      }
    : null
  const profileName = user ? ((user as { nickname?: string | null; username?: string }).nickname ?? (user as { username?: string }).username ?? "用户") : "用户"
  const currentLevel = getVipLevel(vipUser)
  const vipActive = isVipActive(vipUser)
  const milestones = vipMilestones(settings)
  const sidebarUser = await resolveSidebarUser(user, settings)
  const vipPageProps = { milestones, settings, user, vipUser }
  const vipMain = (
    <main className="mt-6 py-1 pb-12">
      <AddonSlotRenderer slot="vip.hero.before" />
      <AddonSurfaceRenderer surface="vip.hero" props={{ milestones, settings, user, vipActive, currentLevel }}>
        <section>
          <Card size="sm" className="rounded-2xl border-border bg-card/95 shadow-[0_18px_58px_-48px_rgba(15,23,42,0.45)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="h-6 rounded-full px-2.5 text-muted-foreground">
                      <Sparkles data-icon="inline-start" />
                      VIP Center
                    </Badge>
                    {user && vipActive ? <VipBadge level={currentLevel} compact showIcon /> : null}
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">超级 VIP</h1>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                  {user ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm">
                      <span className="text-muted-foreground">当前</span>
                      <span className={`font-semibold ${getVipNameClass(vipActive, vipUser?.vipLevel, { emphasize: true, interactive: false })}`}>
                        {profileName}
                      </span>
                      <span className="text-muted-foreground">
                        {vipActive && vipUser?.vipExpiresAt ? `到期 ${formatDateTime(vipUser.vipExpiresAt)}` : "未开通"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-muted-foreground">登录后查看余额与续费状态</span>
                      <Link href={buildLoginHrefWithRedirect("/vip")} className={cn(buttonVariants({ size: "sm" }), "rounded-full px-3")}>
                        登录查看
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </div>
                  )}

                  <div className="hidden flex-wrap gap-2 sm:flex lg:justify-end">
                    {quickBenefits.map((benefit) => {
                      const Icon = benefit.icon

                      return (
                        <Badge key={benefit.title} variant="outline" className="h-7 rounded-full px-2.5 text-muted-foreground">
                          <Icon data-icon="inline-start" />
                          {benefit.title}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="vip.hero.after" />

      <AddonSlotRenderer slot="vip.actions.before" />
      <AddonSurfaceRenderer surface="vip.actions" props={{ settings, user, vipUser }}>
        {user ? (
          <VipActionPanel
            vipMonthlyPrice={settings.vipMonthlyPrice}
            vipQuarterlyPrice={settings.vipQuarterlyPrice}
            vipYearlyPrice={settings.vipYearlyPrice}
            pointName={settings.pointName}
            userPoints={user.points}
            vipExpiresAt={(vipUser?.vipExpiresAt as string | Date | null | undefined)?.toString?.() ?? null}
          />
        ) : null}
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="vip.actions.after" />

      <AddonSlotRenderer slot="vip.levels.before" />
      <AddonSurfaceRenderer surface="vip.levels" props={{ milestones, settings }}>
        <section className="mt-6">
          <div>
            <div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">等级权益对照</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {milestones.map((item) => (
              <Card key={item.level} className="overflow-hidden rounded-2xl border-border bg-card shadow-[0_18px_64px_-52px_rgba(15,23,42,0.35)]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <VipLevelIcon level={item.level} className="size-10 rounded-2xl border border-border bg-background p-2 text-foreground shadow-xs" title={item.title} />
                        <div>
                          <p className="text-lg font-semibold text-foreground">{item.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
                        </div>
                      </div>
                    </div>
                    <VipBadge level={item.level} compact showIcon />
                  </div>
                  <p className="mt-5 rounded-2xl bg-muted/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    {item.requirement}
                  </p>
                  <ul className="mt-5 flex flex-col gap-2 text-sm text-muted-foreground">
                    {item.privileges.map((privilege) => (
                      <li key={`${item.level}-${privilege}`} className="flex gap-2 leading-6">
                        <ShieldCheck className="mt-1 size-4 shrink-0 text-foreground/65" />
                        <span>{privilege}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="vip.levels.after" />
    </main>
  )
  const vipRightSidebar = (
    <aside className="mt-6 hidden pb-12 lg:block">
      <AddonSurfaceRenderer surface="vip.sidebar" props={{ ...vipPageProps, hotTopics, announcements }}>
        <HomeSidebarPanels
          user={sidebarUser}
          currentUserSettings={user ? buildHomeSidebarCurrentUserSettings(settings) : undefined}
          hotTopics={hotTopics}
          postLinkDisplayMode={settings.postLinkDisplayMode}
          announcements={announcements}
          showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
          siteName={settings.siteName}
          siteDescription={settings.siteDescription}
          siteLogoPath={settings.siteLogoPath}
          siteIconPath={settings.siteIconPath}
        />
      </AddonSurfaceRenderer>
    </aside>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="vip.page.before" />
        <AddonSurfaceRenderer surface="vip.page" props={vipPageProps}>
          <ForumPageShell
            zones={zones}
            boards={boards}
            main={vipMain}
            rightSidebar={vipRightSidebar}
          />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="vip.page.after" />
      </div>
    </div>
  )
}
