import type { FeedSort, ForumFeedItem } from "@/lib/forum-feed"
import { mapForumFeedItemsToDisplayItems } from "@/lib/forum-feed-display"
import { type PostListDisplayMode } from "@/lib/post-list-display"
import { getSiteSettings } from "@/lib/site-settings"

import { ForumFeedView } from "@/components/forum/forum-feed-view"

interface ForumFeedListProps {
  items: ForumFeedItem[]
  currentSort: Exclude<FeedSort, "weekly">
  listDisplayMode?: PostListDisplayMode
  postLinkDisplayMode?: "SLUG" | "ID"
}

export async function ForumFeedList({ items, currentSort, listDisplayMode, postLinkDisplayMode = "SLUG" }: ForumFeedListProps) {
  const settings = await getSiteSettings()
  const displayItems = mapForumFeedItemsToDisplayItems(items, currentSort, settings)

  return (
    <ForumFeedView
      items={displayItems}
      listDisplayMode={listDisplayMode}
      postLinkDisplayMode={postLinkDisplayMode}
    />
  )
}
