"use client"

import { useLayoutEffect } from "react"

import { preloadReadingHistorySnapshot } from "@/lib/local-reading-history"
import { resetSidebarNavigationCollapsedPreference } from "@/lib/sidebar-navigation-preference"

export function RootBootstrap() {
  useLayoutEffect(() => {
    resetSidebarNavigationCollapsedPreference()
    preloadReadingHistorySnapshot()
  }, [])

  return null
}
