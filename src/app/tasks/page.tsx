import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getBoards } from "@/lib/boards"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { TaskCenterPage } from "@/components/tasks/task-center-page"
import { getCurrentUser } from "@/lib/auth"
import { getSiteSettings } from "@/lib/site-settings"
import { getTaskCenterPageData } from "@/lib/task-center-page"
import { getZones } from "@/lib/zones"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `任务中心 - ${settings.siteName}`,
    description: `在 ${settings.siteName} 完成签到、发帖、回复、点赞等任务，获取${settings.pointName}奖励并追踪成长进度。`,
    openGraph: {
      title: `任务中心 - ${settings.siteName}`,
      description: `完成社区任务，获取${settings.pointName}奖励并追踪你的每日与挑战进度。`,
      type: "website",
    },
  }
}

export default async function TasksPage() {
  const settingsPromise = getSiteSettings()
  const currentUserPromise = getCurrentUser()
  const [currentUser, data, boards, zones, settings, hotTopics, announcements] = await Promise.all([
    currentUserPromise,
    getTaskCenterPageData(),
    getBoards(),
    getZones(),
    settingsPromise,
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3),
  ])
  if (!currentUser) {
    redirect("/login?redirect=/tasks")
  }

  if (!data) {
    redirect("/login?redirect=/tasks")
  }

  const sidebarUser = await resolveSidebarUser(currentUser, settings)
  const taskSlotProps = {
    userId: currentUser.id,
    pointName: settings.pointName,
    todayCompleted: data.todayCompleted,
    challengeCompleted: data.challengeCompleted,
    totalCompleted: data.totalCompleted,
    totalTasks: data.totalTasks,
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="tasks.page.before" props={taskSlotProps} />
        <AddonSurfaceRenderer surface="tasks.page" props={{ ...taskSlotProps, data }}>
          <ForumPageShell
            zones={zones}
            boards={boards}
            main={(
              <main className="py-1 pb-12 mt-6">
                <TaskCenterPage
                  data={data}
                  headerBefore={<AddonSlotRenderer slot="tasks.header.before" props={taskSlotProps} />}
                  headerAfter={<AddonSlotRenderer slot="tasks.header.after" props={taskSlotProps} />}
                  contentBefore={<AddonSlotRenderer slot="tasks.content.before" props={taskSlotProps} />}
                  contentAfter={<AddonSlotRenderer slot="tasks.content.after" props={taskSlotProps} />}
                />
              </main>
            )}
            rightSidebar={(
              <aside className="mt-6 hidden pb-12 lg:block">
                <HomeSidebarPanels
                  user={sidebarUser}
                  hotTopics={hotTopics}
                  announcements={announcements}
                  showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                  createPostHref="/write"
                  siteName={settings.siteName}
                  siteDescription={settings.siteDescription}
                  siteLogoPath={settings.siteLogoPath}
                  siteIconPath={settings.siteIconPath}
                />
              </aside>
            )}
          />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="tasks.page.after" props={taskSlotProps} />
      </div>
    </div>
  )
}
