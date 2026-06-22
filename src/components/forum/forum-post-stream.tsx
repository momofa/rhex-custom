import type { SitePostItem } from "@/lib/posts"
import { mapSitePostsToDisplayItems } from "@/lib/forum-post-stream-display"
import { type PostListDisplayMode } from "@/lib/post-list-display"
import { getSiteSettings } from "@/lib/site-settings"

import { ForumPostStreamView } from "@/components/forum/forum-post-stream-view"

interface ForumPostStreamProps {
  posts: SitePostItem[]
  listDisplayMode?: PostListDisplayMode
  showBoard?: boolean
  visiblePinScopes?: Array<"GLOBAL" | "ZONE" | "BOARD">
  showPinnedDivider?: boolean
  compactFirstItem?: boolean
}

export async function ForumPostStream({
  posts,
  listDisplayMode,
  showBoard = true,
  visiblePinScopes = ["GLOBAL", "ZONE", "BOARD"],
  showPinnedDivider = false,
  compactFirstItem = true,
}: ForumPostStreamProps) {
  const settings = await getSiteSettings()
  const displayItems = mapSitePostsToDisplayItems(posts, settings, visiblePinScopes)

  return (
    <ForumPostStreamView
      items={displayItems}
      listDisplayMode={listDisplayMode}
      showBoard={showBoard}
      showPinnedDivider={showPinnedDivider}
      compactFirstItem={compactFirstItem}
      postLinkDisplayMode={settings.postLinkDisplayMode}
    />
  )
}
