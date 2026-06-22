import "server-only"

import { unstable_cache } from "next/cache"

import { executeAddonAsyncWaterfallHook } from "@/addons-host/runtime/hooks"
import { queryAddonPosts } from "@/addons-host/runtime/posts"
import { findPostSidebarData } from "@/db/post-sidebar-queries"
import {
  getPostSidebarCacheTag,
  getPostViewerCacheTag,
  POST_PERSONALIZED_CACHE_REVALIDATE_SECONDS,
  POST_SIDEBAR_CACHE_TAG,
} from "@/lib/post-detail-cache"
import { PUBLIC_READABLE_POST_STATUSES } from "@/lib/post-types"

interface PostSidebarRelatedTopic {
  id: string
  slug: string
  title: string
}

function normalizeUniquePostIds(postIds: string[]) {
  const seen = new Set<string>()

  return postIds.filter((postId) => {
    const normalizedPostId = postId.trim()
    if (!normalizedPostId || seen.has(normalizedPostId)) {
      return false
    }

    seen.add(normalizedPostId)
    return true
  })
}

async function resolveHookedRelatedTopics(input: {
  postId: string
  relatedTopics: PostSidebarRelatedTopic[]
  pathname?: string
  searchParams?: URLSearchParams
}) {
  const orderedIds = normalizeUniquePostIds(
    input.relatedTopics.map((item) => item.id),
  )

  if (orderedIds.length === 0) {
    return [] as PostSidebarRelatedTopic[]
  }

  const queried = await queryAddonPosts({
    ids: orderedIds,
    statuses: [...PUBLIC_READABLE_POST_STATUSES],
    includeTotal: false,
    limit: orderedIds.length,
  })
  const queriedById = new Map(queried.items.map((item) => [item.id, item]))
  const initialItems = orderedIds
    .map((postId) => queriedById.get(postId) ?? null)
    .filter((item) => item !== null)
  const hooked = await executeAddonAsyncWaterfallHook(
    "post.related.items",
    initialItems,
    {
      pathname: input.pathname,
      searchParams: input.searchParams,
      payload: {
        postId: input.postId,
      },
    },
  )

  return [...new Map(
    (Array.isArray(hooked.value) ? hooked.value : initialItems)
      .filter((item) => item.id !== input.postId)
      .map((item) => [
        item.id,
        {
          id: item.id,
          slug: item.slug,
          title: item.title,
        } satisfies PostSidebarRelatedTopic,
      ]),
  ).values()]
}

async function readPostSidebarData(
  postId: string,
  authorUsername: string,
  relatedPostsLimit = 5,
  currentUserId?: number | null,
  input?: {
    pathname?: string
    searchParams?: URLSearchParams | string
  },
) {
  const { author, postTags, relatedPosts, favoriteCollections } = await findPostSidebarData(
    postId,
    authorUsername,
    relatedPostsLimit,
    currentUserId,
  )
  const relatedTopics = await resolveHookedRelatedTopics({
    postId,
    relatedTopics: relatedPosts,
    pathname: input?.pathname,
    searchParams: typeof input?.searchParams === "string"
      ? new URLSearchParams(input.searchParams)
      : input?.searchParams,
  })

  return {
    author: author
      ? {
          bio: author.bio,
        }
      : {
          bio: null,
        },
    relatedTopics,
    tags: postTags.map((item) => ({
      id: item.tag.id,
      name: item.tag.name,
      slug: item.tag.slug,
    })),
    collections: favoriteCollections.map((item) => ({
      id: item.collection.id,
      title: item.collection.title,
      visibility: item.collection.visibility,
    })),
  }
}

export async function getPostSidebarData(
  postId: string,
  authorUsername: string,
  relatedPostsLimit = 5,
  currentUserId?: number | null,
  input?: {
    pathname?: string
    searchParams?: URLSearchParams
  },
) {
  const viewerKey = currentUserId ? `user:${currentUserId}` : "guest"
  const viewerTags = currentUserId ? [getPostViewerCacheTag(currentUserId)] : []
  const pathname = input?.pathname ?? ""
  const searchParams = input?.searchParams?.toString() ?? ""

  return unstable_cache(
    async () => readPostSidebarData(postId, authorUsername, relatedPostsLimit, currentUserId, {
      pathname,
      searchParams,
    }),
    [
      POST_SIDEBAR_CACHE_TAG,
      postId,
      authorUsername,
      String(relatedPostsLimit),
      viewerKey,
      pathname,
      searchParams,
    ],
    {
      tags: [
        POST_SIDEBAR_CACHE_TAG,
        getPostSidebarCacheTag(postId),
        ...viewerTags,
      ],
      revalidate: POST_PERSONALIZED_CACHE_REVALIDATE_SECONDS,
    },
  )()
}
