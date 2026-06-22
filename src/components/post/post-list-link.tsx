"use client"

import Link from "next/link"
import { useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from "react"

import {
  DEFAULT_BROWSING_PREFERENCES,
  readBrowsingPreferencesSnapshot,
  subscribeBrowsingPreferences,
} from "@/lib/browsing-preferences"
import {
  DEFAULT_READING_HISTORY_SNAPSHOT,
  hasVisitedPostPath,
  readReadingHistorySnapshot,
  subscribeReadingHistory,
} from "@/lib/local-reading-history"
import { cn } from "@/lib/utils"

interface PostListLinkProps {
  href: string
  visitedPath?: string
  dimWhenRead?: boolean
  className?: string
  title?: string
  style?: CSSProperties
  children: ReactNode
}

function applyCommentPreferencesToHref(href: string, preferences: Pick<typeof DEFAULT_BROWSING_PREFERENCES, "commentThreadDisplayMode" | "commentThreadSort">) {
  try {
    const url = new URL(href, "https://rhex.local")
    if (!url.pathname.startsWith("/posts/")) {
      return href
    }

    if (preferences.commentThreadDisplayMode === "flat" && !url.searchParams.has("view")) {
      url.searchParams.set("view", preferences.commentThreadDisplayMode)
    }

    if (preferences.commentThreadSort === "newest" && !url.searchParams.has("sort")) {
      url.searchParams.set("sort", preferences.commentThreadSort)
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return href
  }
}

export function PostListLink({ href, visitedPath, dimWhenRead = false, className, title, style, children }: PostListLinkProps) {
  const preferences = useSyncExternalStore(
    subscribeBrowsingPreferences,
    readBrowsingPreferencesSnapshot,
    () => DEFAULT_BROWSING_PREFERENCES,
  )
  const readingHistory = useSyncExternalStore(
    subscribeReadingHistory,
    readReadingHistorySnapshot,
    () => DEFAULT_READING_HISTORY_SNAPSHOT,
  )
  const isVisited = useMemo(
    () => Boolean(dimWhenRead && visitedPath && preferences.dimReadPostTitles && hasVisitedPostPath(readingHistory, visitedPath)),
    [dimWhenRead, preferences.dimReadPostTitles, readingHistory, visitedPath],
  )
  const resolvedHref = useMemo(
    () => applyCommentPreferencesToHref(href, preferences),
    [href, preferences],
  )

  return (
    <Link
      href={resolvedHref}
      title={title}
      target={preferences.openPostLinksInNewTab ? "_blank" : undefined}
      rel={preferences.openPostLinksInNewTab ? "noreferrer noopener" : undefined}
      style={style}
      className={cn(className, isVisited ? "opacity-55" : null)}
    >
      {children}
    </Link>
  )
}
