"use client"

import { useCurrentUser } from "@/components/current-user-provider"
import { ReadingHistoryPanel } from "@/components/post/reading-history-panel"

export function HomeSidebarCurrentUserReadingHistory() {
  const { user } = useCurrentUser()

  if (!user) {
    return null
  }

  return (
    <ReadingHistoryPanel
      variant="sidebar"
      title="近期访问"
      limit={5}
      moreHref="/settings?tab=follows&followTab=history"
      showOnlyToday
      requireLoggedIn
      isLoggedIn
      hideWhenEmpty
      stabilizeLayoutOnHydration
    />
  )
}
