import {
  buildBoardSearchWhere,
  buildFavoriteCollectionSearchWhere,
  buildPostSearchWhere,
  buildTagSearchWhere,
  buildUserSearchWhere,
  countSearchBoards,
  countSearchFavoriteCollections,
  countSearchPosts,
  countSearchTags,
  countSearchUsers,
  findSearchBoardsPage,
  findSearchFavoriteCollectionsPage,
  findSearchPostsCursor,
  findSearchTagsPage,
  findSearchUsersPage,
} from "@/db/search-queries"
import { decodePinnedTimestampCursor, encodePinnedTimestampCursor } from "@/lib/cursor-pagination"
import { formatCompactNumber } from "@/lib/formatters"
import { getLevelBadgeData } from "@/lib/level-badge"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { getPostPath } from "@/lib/post-links"
import { getSiteSettings } from "@/lib/site-settings"

import { mapListPost } from "@/lib/post-map"
import {
  applyHookedUserPresentationToNamedItem,
  applyHookedUserPresentationToSitePosts,
} from "@/lib/user-presentation-server"
import type { PublicUserRoleBadge } from "@/lib/user-presentation"
import {
  executeAddonActionHook,
  executeAddonAsyncWaterfallHook,
  executeAddonWaterfallHook,
} from "@/addons-host/runtime/hooks"
import { getUserDisplayName } from "@/lib/user-display"




import type { SitePostItem } from "@/lib/posts"

export const SEARCH_SCOPES = ["posts", "boards", "tags", "users", "collections"] as const

export type SearchScope = (typeof SEARCH_SCOPES)[number]

export const DEFAULT_SEARCH_SCOPE: SearchScope = "posts"

export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  posts: "帖子",
  boards: "节点",
  tags: "标签",
  users: "用户",
  collections: "收藏",
}

export const SEARCH_SCOPE_DESCRIPTIONS: Record<SearchScope, string> = {
  posts: "搜索帖子标题、摘要与正文内容。",
  boards: "搜索节点名称、slug、简介与所属分区。",
  tags: "搜索标签名称与 slug。",
  users: "搜索用户名、昵称与简介。",
  collections: "搜索公开收藏合集，以及你自己的私有合集。",
}

export interface SearchResultItem extends SitePostItem {
  href: string
}


export interface SearchResults {
  keyword: string
  total: number | null
  items: SearchResultItem[]
  hasPrevPage: boolean
  hasNextPage: boolean
  prevCursor: string | null
  nextCursor: string | null
}

export interface SearchPagedResults<TItem> {
  keyword: string
  total: number
  items: TItem[]
  page: number
  pageSize: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface SearchBoardItem {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  postCount: number
  followerCount: number
  zoneName: string | null
  zoneSlug: string | null
}

export interface SearchTagItem {
  id: string
  name: string
  slug: string
  postCount: number
  createdAt: string
}

export interface SearchUserItem {
  id: number
  publicUid?: string | null
  username: string
  displayName: string
  avatarPath: string | null
  bio: string
  role: "USER" | "MODERATOR" | "ADMIN"
  roleBadge?: PublicUserRoleBadge | null
  status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  level: number
  levelName?: string | null
  levelColor?: string | null
  levelIcon?: string | null
  vipLevel: number
  vipExpiresAt: string | null
  postCount: number
  commentCount: number
  likeReceivedCount: number
  followerCount: number
  favoriteCount: number
  boardFollowCount: number
}

export interface SearchFavoriteCollectionItem {
  id: string
  title: string
  description: string
  visibility: "PUBLIC" | "PRIVATE"
  allowOtherUsersToContribute: boolean
  requireContributionApproval: boolean
  postCount: number
  createdAt: string
  updatedAt: string
  owner: {
    id: number
    publicUid?: string | null
    username: string
    displayName: string
    avatarPath: string | null
  }
}

export type SearchScopedResults =
  | { scope: "posts"; data: SearchResults }
  | { scope: "boards"; data: SearchPagedResults<SearchBoardItem> }
  | { scope: "tags"; data: SearchPagedResults<SearchTagItem> }
  | { scope: "users"; data: SearchPagedResults<SearchUserItem> }
  | { scope: "collections"; data: SearchPagedResults<SearchFavoriteCollectionItem> }

function normalizeKeyword(keyword: string) {
  return keyword.trim().slice(0, 50)
}

async function resolveNormalizedKeyword(keyword: string) {
  const baseKeyword = normalizeKeyword(keyword)
  const { value } = await executeAddonWaterfallHook(
    "search.query.normalize",
    baseKeyword,
  )

  return normalizeKeyword(String(value ?? ""))
}

export function normalizeSearchScope(value: string | null | undefined): SearchScope {
  return SEARCH_SCOPES.includes(value as SearchScope) ? (value as SearchScope) : DEFAULT_SEARCH_SCOPE
}

function normalizeSearchPage(page: number | null | undefined) {
  if (!page || Number.isNaN(page)) {
    return 1
  }

  return Math.max(1, Math.trunc(page))
}

function normalizeSearchPageSize(pageSize: number | null | undefined, fallback = 12) {
  if (!pageSize || Number.isNaN(pageSize)) {
    return fallback
  }

  return Math.min(50, Math.max(1, Math.trunc(pageSize)))
}

function createEmptyPagedResults<TItem>(
  keyword: string,
  page: number,
  pageSize: number,
): SearchPagedResults<TItem> {
  return {
    keyword,
    total: 0,
    items: [],
    page,
    pageSize,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  }
}

function buildPagedResults<TItem>(
  keyword: string,
  total: number,
  items: TItem[],
  page: number,
  pageSize: number,
): SearchPagedResults<TItem> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    keyword,
    total,
    items,
    page,
    pageSize,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

function formatSearchCount(value: number, suffix: string) {
  return `${formatCompactNumber(value)} ${suffix}`
}

async function resolveSearchEnabled(searchEnabled?: boolean) {
  if (searchEnabled !== undefined) {
    return searchEnabled
  }

  const settings = await getSiteSettings()
  return settings.search.enabled
}

export async function searchPosts(
  keyword: string,
  options: {
    pageSize?: number
    after?: string | null
    before?: string | null
    includeTotal?: boolean
    searchEnabled?: boolean
    postLinkDisplayMode?: "SLUG" | "ID"
  } = {},
): Promise<SearchResults> {
  const normalizedKeyword = await resolveNormalizedKeyword(keyword)

  if (!normalizedKeyword) {
    return {
      keyword: "",
      total: 0,
      items: [],
      hasPrevPage: false,
      hasNextPage: false,
      prevCursor: null,
      nextCursor: null,
    }
  }

  try {
    const settings = options.searchEnabled === undefined || !options.postLinkDisplayMode
      ? await getSiteSettings()
      : null
    const searchEnabled = options.searchEnabled ?? settings?.search.enabled ?? false
    const postLinkDisplayMode = options.postLinkDisplayMode ?? settings?.postLinkDisplayMode ?? "SLUG"

    if (!searchEnabled) {
      return {
        keyword: normalizedKeyword,
        total: 0,
        items: [],
        hasPrevPage: false,
        hasNextPage: false,
        prevCursor: null,
        nextCursor: null,
      }
    }

    const where = buildPostSearchWhere(normalizedKeyword)
    const afterCursor = decodePinnedTimestampCursor(options.after)
    const beforeCursor = decodePinnedTimestampCursor(options.before)
    const includeTotal = options.includeTotal ?? (!options.after && !options.before)

    const [{ items: posts, hasPrevPage, hasNextPage }, total, anonymousMaskIdentity] = await Promise.all([
      findSearchPostsCursor({
        where,
        pageSize: options.pageSize ?? 10,
        after: beforeCursor ? null : afterCursor,
        before: beforeCursor,
      }),
      includeTotal ? countSearchPosts(where) : Promise.resolve(null),
      getAnonymousMaskDisplayIdentity(),
    ] as const)

    const baseItems = await applyHookedUserPresentationToSitePosts(posts.map((post: (typeof posts)[number]) => ({
      ...mapListPost(post, anonymousMaskIdentity),
      href: getPostPath(post, { mode: postLinkDisplayMode }),
    })))
    type SearchItem = (typeof baseItems)[number]

    const itemById = new Map<string, SearchItem>(baseItems.map((it) => [it.id, it]))
    const rerankInput = baseItems.map((it, index) => ({
      id: it.id,
      score: baseItems.length - index,
      kind: "post" as const,
    }))
    const { value: rerankedRefs } = await executeAddonAsyncWaterfallHook(
      "search.results.rerank",
      rerankInput,
      {
        payload: {
          query: normalizedKeyword,
          scope: "post",
        },
      },
    )
    const items: SearchItem[] = rerankedRefs
      .map((ref) => itemById.get(ref.id))
      .filter((it): it is SearchItem => it !== undefined)

    await executeAddonActionHook("search.query.after", {
      query: normalizedKeyword,
      scope: "post",
      resultCount: items.length,
    })

    return {
      keyword: normalizedKeyword,
      total,
      items,
      hasPrevPage,
      hasNextPage,
      prevCursor: posts.length > 0 ? encodePinnedTimestampCursor({ id: posts[0].id, createdAt: posts[0].createdAt.toISOString(), isPinned: posts[0].isPinned }) : null,
      nextCursor: posts.length > 0 ? encodePinnedTimestampCursor({ id: posts[posts.length - 1].id, createdAt: posts[posts.length - 1].createdAt.toISOString(), isPinned: posts[posts.length - 1].isPinned }) : null,
    }
  } catch (error) {
    console.error(error)
    return {
      keyword: normalizedKeyword,
      total: null,
      items: [],
      hasPrevPage: false,
      hasNextPage: false,
      prevCursor: null,
      nextCursor: null,
    }
  }
}

export async function searchBoards(
  keyword: string,
  options: {
    page?: number
    pageSize?: number
    searchEnabled?: boolean
  } = {},
): Promise<SearchPagedResults<SearchBoardItem>> {
  const normalizedKeyword = await resolveNormalizedKeyword(keyword)
  const page = normalizeSearchPage(options.page)
  const pageSize = normalizeSearchPageSize(options.pageSize)

  if (!normalizedKeyword || !(await resolveSearchEnabled(options.searchEnabled))) {
    return createEmptyPagedResults(normalizedKeyword, page, pageSize)
  }

  try {
    const where = buildBoardSearchWhere(normalizedKeyword)
    const total = await countSearchBoards(where)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const boards = total > 0
      ? await findSearchBoardsPage({ where, page: safePage, pageSize })
      : []
    const items = boards.map((board) => ({
      id: board.id,
      name: board.name,
      slug: board.slug,
      description: board.description ?? `${board.name} 节点讨论区`,
      icon: board.iconPath ?? "💬",
      postCount: board._count.posts,
      followerCount: board.followerCount,
      zoneName: board.zone?.name ?? null,
      zoneSlug: board.zone?.slug ?? null,
    }))

    await executeAddonActionHook("search.query.after", {
      query: normalizedKeyword,
      scope: "board",
      resultCount: items.length,
    })

    return buildPagedResults(normalizedKeyword, total, items, safePage, pageSize)
  } catch (error) {
    console.error(error)
    return createEmptyPagedResults(normalizedKeyword, page, pageSize)
  }
}

export async function searchTags(
  keyword: string,
  options: {
    page?: number
    pageSize?: number
    searchEnabled?: boolean
  } = {},
): Promise<SearchPagedResults<SearchTagItem>> {
  const normalizedKeyword = await resolveNormalizedKeyword(keyword)
  const page = normalizeSearchPage(options.page)
  const pageSize = normalizeSearchPageSize(options.pageSize)

  if (!normalizedKeyword || !(await resolveSearchEnabled(options.searchEnabled))) {
    return createEmptyPagedResults(normalizedKeyword, page, pageSize)
  }

  try {
    const where = buildTagSearchWhere(normalizedKeyword)
    const total = await countSearchTags(where)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const tags = total > 0
      ? await findSearchTagsPage({ where, page: safePage, pageSize })
      : []
    const items = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      postCount: tag.postCount,
      createdAt: tag.createdAt.toISOString(),
    }))

    await executeAddonActionHook("search.query.after", {
      query: normalizedKeyword,
      scope: "tag",
      resultCount: items.length,
    })

    return buildPagedResults(normalizedKeyword, total, items, safePage, pageSize)
  } catch (error) {
    console.error(error)
    return createEmptyPagedResults(normalizedKeyword, page, pageSize)
  }
}

export async function searchUsers(
  keyword: string,
  options: {
    page?: number
    pageSize?: number
    searchEnabled?: boolean
  } = {},
): Promise<SearchPagedResults<SearchUserItem>> {
  const normalizedKeyword = await resolveNormalizedKeyword(keyword)
  const page = normalizeSearchPage(options.page)
  const pageSize = normalizeSearchPageSize(options.pageSize)

  if (!normalizedKeyword || !(await resolveSearchEnabled(options.searchEnabled))) {
    return createEmptyPagedResults(normalizedKeyword, page, pageSize)
  }

  try {
    const where = buildUserSearchWhere(normalizedKeyword)
    const total = await countSearchUsers(where)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const users = total > 0
      ? await findSearchUsersPage({ where, page: safePage, pageSize })
      : []
    const items = await Promise.all(users.map(async (user) => {
      const levelBadge = await getLevelBadgeData(user.level)

      return applyHookedUserPresentationToNamedItem({
        id: user.id,
        username: user.username,
        displayName: getUserDisplayName(user),
        avatarPath: user.avatarPath,
        bio: user.bio?.trim() || "这个用户还没有留下简介。",
        role: user.role,
        status: user.status,
        level: user.level,
        levelName: levelBadge.name,
        levelColor: levelBadge.color,
        levelIcon: levelBadge.icon,
        vipLevel: user.vipLevel,
        vipExpiresAt: user.vipExpiresAt?.toISOString() ?? null,
        postCount: user.postCount,
        commentCount: user.commentCount,
        likeReceivedCount: user.likeReceivedCount,
        followerCount: user._count.followedByUsers,
        favoriteCount: user._count.favorites,
        boardFollowCount: user._count.boardFollows,
      })
    }))

    await executeAddonActionHook("search.query.after", {
      query: normalizedKeyword,
      scope: "user",
      resultCount: items.length,
    })

    return buildPagedResults(normalizedKeyword, total, items, safePage, pageSize)
  } catch (error) {
    console.error(error)
    return createEmptyPagedResults(normalizedKeyword, page, pageSize)
  }
}

export async function searchFavoriteCollections(
  keyword: string,
  options: {
    page?: number
    pageSize?: number
    currentUserId?: number | null
    searchEnabled?: boolean
  } = {},
): Promise<SearchPagedResults<SearchFavoriteCollectionItem>> {
  const normalizedKeyword = await resolveNormalizedKeyword(keyword)
  const page = normalizeSearchPage(options.page)
  const pageSize = normalizeSearchPageSize(options.pageSize)

  if (!normalizedKeyword || !(await resolveSearchEnabled(options.searchEnabled))) {
    return createEmptyPagedResults(normalizedKeyword, page, pageSize)
  }

  try {
    const where = buildFavoriteCollectionSearchWhere(normalizedKeyword, options.currentUserId)
    const total = await countSearchFavoriteCollections(where)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const collections = total > 0
      ? await findSearchFavoriteCollectionsPage({ where, page: safePage, pageSize })
      : []
    const ownerItems = await Promise.all(collections.map((collection) => applyHookedUserPresentationToNamedItem({
      id: collection.owner.id,
      username: collection.owner.username,
      displayName: getUserDisplayName(collection.owner),
      avatarPath: collection.owner.avatarPath,
      role: collection.owner.role,
      status: collection.owner.status,
    })))
    const items = collections.map((collection, index) => ({
      id: collection.id,
      title: collection.title,
      description: collection.description?.trim() || `这个收藏共收录 ${formatSearchCount(collection.postCount, "篇内容")}。`,
      visibility: collection.visibility,
      allowOtherUsersToContribute: collection.allowOtherUsersToContribute,
      requireContributionApproval: collection.requireContributionApproval,
      postCount: collection.postCount,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
      owner: {
        id: ownerItems[index]!.id,
        publicUid: ownerItems[index]!.publicUid,
        username: ownerItems[index]!.username,
        displayName: ownerItems[index]!.displayName,
        avatarPath: ownerItems[index]!.avatarPath ?? null,
      },
    }))

    await executeAddonActionHook("search.query.after", {
      query: normalizedKeyword,
      scope: "collection",
      resultCount: items.length,
    })

    return buildPagedResults(normalizedKeyword, total, items, safePage, pageSize)
  } catch (error) {
    console.error(error)
    return createEmptyPagedResults(normalizedKeyword, page, pageSize)
  }
}

export async function searchByScope(
  scope: SearchScope,
  keyword: string,
  options: {
    page?: number
    pageSize?: number
    after?: string | null
    before?: string | null
    includeTotal?: boolean
    currentUserId?: number | null
    searchEnabled?: boolean
    postLinkDisplayMode?: "SLUG" | "ID"
  } = {},
): Promise<SearchScopedResults> {
  switch (scope) {
    case "boards":
      return {
        scope,
        data: await searchBoards(keyword, options),
      }
    case "tags":
      return {
        scope,
        data: await searchTags(keyword, options),
      }
    case "users":
      return {
        scope,
        data: await searchUsers(keyword, options),
      }
    case "collections":
      return {
        scope,
        data: await searchFavoriteCollections(keyword, options),
      }
    case "posts":
    default:
      return {
        scope: "posts",
        data: await searchPosts(keyword, options),
      }
  }
}
