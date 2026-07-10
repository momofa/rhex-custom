"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import {
  consumeContentMutationRefresh,
  readContentMutationMarker,
  readContentMutationRefreshMarker,
} from "@/lib/content-mutation-marker.client"

export function NavigationStaleRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const handledMarkersByPathRef = useRef(new Map<string, number>())

  useEffect(() => {
    const marker = readContentMutationMarker()
    if (!marker) {
      return
    }

    const handledMarker = Math.max(
      handledMarkersByPathRef.current.get(pathname) ?? 0,
      readContentMutationRefreshMarker(pathname),
    )
    if (handledMarker === marker) {
      return
    }

    const consumedMarker = consumeContentMutationRefresh(pathname)
    if (!consumedMarker) {
      return
    }

    handledMarkersByPathRef.current.set(pathname, marker)
    router.refresh()
  }, [pathname, router])

  useEffect(() => {
    function refreshIfNeeded() {
      const currentPath = window.location.pathname
      const marker = readContentMutationMarker()
      const handledMarker = Math.max(
        handledMarkersByPathRef.current.get(currentPath) ?? 0,
        readContentMutationRefreshMarker(currentPath),
      )
      if (!marker || marker === handledMarker) {
        return
      }

      const consumedMarker = consumeContentMutationRefresh(currentPath)
      if (!consumedMarker) {
        return
      }

      handledMarkersByPathRef.current.set(currentPath, marker)
      router.refresh()
    }

    function handlePageShow() {
      refreshIfNeeded()
    }

    function handleFocus() {
      refreshIfNeeded()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshIfNeeded()
      }
    }

    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [router])

  return null
}
