import { revalidateTag } from "next/cache"

import {
  expireTaxonomyContentCacheImmediately,
  revalidateTaxonomyContentCache,
} from "@/lib/taxonomy-cache"

export const FORUM_FEED_CACHE_TAG = "forum-feed"
export const HOME_SIDEBAR_HOT_TOPICS_CACHE_TAG = "home-sidebar-hot-topics"

type ContentListRevalidateProfile = "max" | { expire: 0 }

function revalidateContentListTag(tag: string, profile: ContentListRevalidateProfile) {
  try {
    revalidateTag(tag, profile)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidateTag")
      || message.includes('used "revalidateTag ')
    ) {
      return
    }

    throw error
  }
}

export function revalidateForumFeedCache() {
  revalidateContentListTag(FORUM_FEED_CACHE_TAG, "max")
}

export function expireForumFeedCacheImmediately() {
  revalidateContentListTag(FORUM_FEED_CACHE_TAG, { expire: 0 })
}

export function revalidateHomeSidebarHotTopicsCache() {
  revalidateContentListTag(HOME_SIDEBAR_HOT_TOPICS_CACHE_TAG, "max")
}

export function expireHomeSidebarHotTopicsCacheImmediately() {
  revalidateContentListTag(HOME_SIDEBAR_HOT_TOPICS_CACHE_TAG, { expire: 0 })
}

export function revalidateContentListCaches() {
  revalidateForumFeedCache()
  revalidateHomeSidebarHotTopicsCache()
  revalidateTaxonomyContentCache()
}

export function expireContentListCachesImmediately() {
  expireForumFeedCacheImmediately()
  expireHomeSidebarHotTopicsCacheImmediately()
  expireTaxonomyContentCacheImmediately()
}
