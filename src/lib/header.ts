import { getUserSurfaceSnapshot } from "@/lib/user-surface"

export interface HeaderUnreadCounts {
  unreadNotificationCount: number
  unreadMessageCount: number
}

export interface HeaderQuickActionsState {
  checkedInToday: boolean
}


export async function getHeaderUnreadCounts(userId?: number | null): Promise<HeaderUnreadCounts> {
  const snapshot = await getUserSurfaceSnapshot(userId)

  return {
    unreadNotificationCount: snapshot?.unreadNotificationCount ?? 0,
    unreadMessageCount: snapshot?.unreadMessageCount ?? 0,
  }
}

export async function getHeaderQuickActionsState(userId?: number | null): Promise<HeaderQuickActionsState> {
  const snapshot = await getUserSurfaceSnapshot(userId)

  return {
    checkedInToday: snapshot?.checkedInToday ?? false,
  }
}
