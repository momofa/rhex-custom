import "server-only"

import { revalidatePath } from "next/cache"

import { expireContentListCachesImmediately } from "@/lib/content-list-cache"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import {
  revalidatePostCommentCache,
  revalidatePostDetailCache,
  revalidatePostViewerCache,
} from "@/lib/post-detail-cache"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    if (type) {
      revalidatePath(path, type)
      return
    }

    revalidatePath(path)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidatePath")
      || message.includes('used "revalidatePath ')
    ) {
      return
    }

    throw error
  }
}

export function revalidateCheckInMutation(input: { userId: number }) {
  revalidateUserSurfaceCache(input.userId)
  safeRevalidatePath("/", "layout")
}

export function revalidateApprovedPostMutation(input: {
  postId: string
  postSlug: string
  boardSlug?: string | null
  zoneSlug?: string | null
  authorId: number
  affectedTagSlugs?: string[]
}) {
  revalidateUpdatedPostMutation(input)
  revalidateHomeSidebarStatsCache()
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
}

export function revalidateUpdatedPostMutation(input: {
  postId: string
  postSlug?: string | null
  boardSlug?: string | null
  previousBoardSlug?: string | null
  zoneSlug?: string | null
  previousZoneSlug?: string | null
  authorId?: number | null
  affectedTagSlugs?: string[]
}) {
  if (input.authorId) {
    revalidateUserSurfaceCache(input.authorId)
  }

  expireContentListCachesImmediately()
  expireTaxonomyCacheImmediately()
  revalidatePostDetailCache({ postId: input.postId, slug: input.postSlug })
  safeRevalidatePath("/")
  safeRevalidatePath("/latest")
  safeRevalidatePath("/new")
  safeRevalidatePath("/hot")
  safeRevalidatePath("/following")
  safeRevalidatePath("/admin")
  safeRevalidatePath("/rss.xml")
  safeRevalidatePath("/settings")
  safeRevalidatePath("/users/[username]", "page")
  safeRevalidatePath("/collections/[id]", "page")
  safeRevalidatePath("/latest/page/[page]", "page")
  safeRevalidatePath("/new/page/[page]", "page")
  safeRevalidatePath("/hot/page/[page]", "page")
  safeRevalidatePath("/posts/[slug]", "page")
  safeRevalidatePath("/boards/[slug]", "page")
  safeRevalidatePath("/zones/[slug]", "page")
  safeRevalidatePath("/tags")
  safeRevalidatePath("/tags/[slug]", "page")

  if (input.postSlug) {
    safeRevalidatePath(`/posts/${input.postSlug}`)
  }

  for (const boardSlug of uniqueStrings([input.boardSlug, input.previousBoardSlug])) {
    safeRevalidatePath(`/boards/${boardSlug}`)
    safeRevalidatePath(`/boards/${boardSlug}/rss.xml`)
  }

  for (const zoneSlug of uniqueStrings([input.zoneSlug, input.previousZoneSlug])) {
    safeRevalidatePath(`/zones/${zoneSlug}`)
    safeRevalidatePath(`/zones/${zoneSlug}/rss.xml`)
  }

  for (const tagSlug of uniqueStrings(input.affectedTagSlugs ?? [])) {
    safeRevalidatePath(`/tags/${tagSlug}`)
    safeRevalidatePath(`/tags/${tagSlug}/rss.xml`)
  }
}

export function revalidateApprovedCommentMutation(input: {
  postId: string
  postSlug?: string | null
  boardSlug?: string | null
  zoneSlug?: string | null
  authorId: number
}) {
  revalidateUpdatedCommentMutation(input)
  revalidatePostViewerCache(input.authorId)
  revalidateHomeSidebarStatsCache()
}

export function revalidateUpdatedCommentMutation(input: {
  postId: string
  postSlug?: string | null
  boardSlug?: string | null
  zoneSlug?: string | null
  authorId?: number | null
}) {
  if (input.authorId) {
    revalidateUserSurfaceCache(input.authorId)
  }

  revalidatePostCommentCache({ postId: input.postId, slug: input.postSlug })
  expireContentListCachesImmediately()
  safeRevalidatePath("/")
  safeRevalidatePath("/latest")
  safeRevalidatePath("/new")
  safeRevalidatePath("/hot")
  safeRevalidatePath("/following")
  safeRevalidatePath("/settings")
  safeRevalidatePath("/users/[username]", "page")
  safeRevalidatePath("/latest/page/[page]", "page")
  safeRevalidatePath("/new/page/[page]", "page")
  safeRevalidatePath("/hot/page/[page]", "page")
  safeRevalidatePath("/posts/[slug]", "page")
  safeRevalidatePath("/boards/[slug]", "page")
  safeRevalidatePath("/zones/[slug]", "page")
  safeRevalidatePath("/tags/[slug]", "page")

  if (input.postSlug) {
    safeRevalidatePath(`/posts/${input.postSlug}`)
  }

  if (input.boardSlug) {
    safeRevalidatePath(`/boards/${input.boardSlug}`)
  }

  if (input.zoneSlug) {
    safeRevalidatePath(`/zones/${input.zoneSlug}`)
  }
}
