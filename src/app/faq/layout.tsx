import type { ReactNode } from "react"

import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { buildHomeSidebarCurrentUserSettings, HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"
import { getHomeAnnouncements } from "@/lib/announcements"

export const dynamic = "force-dynamic"

export default async function FaqLayout({ children }: { children: ReactNode }) {
  const settingsPromise = getSiteSettings()
  const [boards, zones, hotTopics, settings, announcements] = await Promise.all([
    getBoards(),
    getZones(),
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    settingsPromise,
    getHomeAnnouncements(3),
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={<main className="py-1 pb-12">{children}</main>}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels user={null} currentUserSettings={buildHomeSidebarCurrentUserSettings(settings)} hotTopics={hotTopics} announcements={announcements}
                showAnnouncements={settings.homeSidebarAnnouncementsEnabled} createPostHref="/write" siteName={settings.siteName} siteDescription={settings.siteDescription} siteLogoPath={settings.siteLogoPath} siteIconPath={settings.siteIconPath} />
            </aside>
          )}
        />
      </div>
    </div>
  )
}
