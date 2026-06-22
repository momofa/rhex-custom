import "server-only"

import { revalidatePath, revalidateTag } from "next/cache"

import { expireContentListCachesImmediately } from "@/lib/content-list-cache"
import {
  POST_COMMENT_LIST_CACHE_TAG,
  POST_DETAIL_DATA_CACHE_TAG,
  POST_SIDEBAR_CACHE_TAG,
  POST_VIEWER_CACHE_TAG,
} from "@/lib/post-detail-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

function isRevalidateContextError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith("Invariant: static generation store missing in revalidatePath")
    || message.startsWith("Invariant: static generation store missing in revalidateTag")
    || message.includes('used "revalidatePath ')
    || message.includes('used "revalidateTag ')
}

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    if (type) {
      revalidatePath(path, type)
      return
    }

    revalidatePath(path)
  } catch (error) {
    if (isRevalidateContextError(error)) {
      return
    }

    throw error
  }
}

function safeExpireTag(tag: string) {
  try {
    revalidateTag(tag, { expire: 0 })
  } catch (error) {
    if (isRevalidateContextError(error)) {
      return
    }

    throw error
  }
}

export function revalidateBadgeDefinitionMutation() {
  revalidateUserSurfaceCache()
  expireContentListCachesImmediately()
  safeExpireTag(POST_DETAIL_DATA_CACHE_TAG)
  safeExpireTag(POST_COMMENT_LIST_CACHE_TAG)
  safeExpireTag(POST_SIDEBAR_CACHE_TAG)
  safeExpireTag(POST_VIEWER_CACHE_TAG)

  safeRevalidatePath("/", "layout")
  safeRevalidatePath("/admin")
  safeRevalidatePath("/settings")
  safeRevalidatePath("/badges/[code]", "page")
  safeRevalidatePath("/faq/badge-system")
  safeRevalidatePath("/users/[username]", "page")
  safeRevalidatePath("/posts/[slug]", "page")
}

export function revalidateUserBadgeMutation(userId: number) {
  revalidateUserSurfaceCache(userId)
  expireContentListCachesImmediately()
  safeExpireTag(POST_DETAIL_DATA_CACHE_TAG)
  safeExpireTag(POST_COMMENT_LIST_CACHE_TAG)
  safeExpireTag(POST_SIDEBAR_CACHE_TAG)
  safeExpireTag(POST_VIEWER_CACHE_TAG)

  safeRevalidatePath("/", "layout")
  safeRevalidatePath("/settings")
  safeRevalidatePath("/badges/[code]", "page")
  safeRevalidatePath("/users/[username]", "page")
  safeRevalidatePath("/posts/[slug]", "page")
}
