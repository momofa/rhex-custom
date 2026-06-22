"use client"

import { useCurrentUser } from "@/components/current-user-provider"
import { AutoCheckInOnHomeEnter } from "@/components/home/auto-check-in-on-home-enter"

interface AutoCheckInOnHomeEnterCurrentUserProps {
  enabled: boolean
  todayKey: string
}

export function AutoCheckInOnHomeEnterCurrentUser({
  enabled,
  todayKey,
}: AutoCheckInOnHomeEnterCurrentUserProps) {
  const { user, surface, features } = useCurrentUser()

  if (
    !enabled
    || !user?.id
    || surface?.checkedInToday
    || !features?.homeAutoCheckIn
  ) {
    return null
  }

  return (
    <AutoCheckInOnHomeEnter
      enabled
      todayKey={todayKey}
      userId={user.id}
    />
  )
}
