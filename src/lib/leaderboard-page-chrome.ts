import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

export async function getLeaderboardPageChromeData() {
  const settingsPromise = getSiteSettings()
  const currentUserPromise = getCurrentUser()

  const [settings, currentUser, boards, zones, hotTopics, announcements] = await Promise.all([
    settingsPromise,
    currentUserPromise,
    getBoards(),
    getZones(),
    settingsPromise.then((resolved) => getHomeSidebarHotTopics(resolved.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3),
  ])

  const sidebarUser = await resolveSidebarUser(currentUser, settings)

  return {
    settings,
    currentUser,
    boards,
    zones,
    hotTopics,
    announcements,
    sidebarUser,
  }
}
