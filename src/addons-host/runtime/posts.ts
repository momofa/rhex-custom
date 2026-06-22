import "server-only"

import { prisma } from "@/db/client"
import { BoardStatus, PostStatus, type Prisma } from "@/db/types"
import { executePostCreation } from "@/lib/post-create-execution"
import { ensurePostLiked } from "@/lib/interaction-like-execution"
import { tipPost } from "@/lib/post-tips"
import { getUserDisplayName } from "@/lib/user-display"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { withWriteGuard } from "@/lib/write-guard"
import { createWriteGuardOptions } from "@/lib/write-guard-policies"
import { assertAddonActorStatus, resolveAddonActor } from "@/addons-host/runtime/actors"
import type {
  AddonBoardSummary,
  AddonPostCreateInput,
  AddonPostCreateResult,
  AddonPostLikeInput,
  AddonPostLikeResult,
  AddonPostQueryOptions,
  AddonPostQueryResult,
  AddonPostQuerySort,
  AddonPostRecord,
  AddonPostStatusMode,
  AddonPostTipInput,
  AddonPostTipResult,
  AddonSortDirection,
  AddonUserSummary,
  AddonZoneSummary,
  LoadedAddonRuntime,
} from "@/addons-host/types"

const DEFAULT_POST_QUERY_LIMIT = 20
const MAX_POST_QUERY_LIMIT = 200
const ADDON_POST_QUERY_SORT_FIELDS = new Set<AddonPostQuerySort["field"]>([
  "createdAt",
  "updatedAt",
  "publishedAt",
  "lastCommentedAt",
  "activityAt",
  "commentCount",
  "viewCount",
  "likeCount",
  "favoriteCount",
  "tipCount",
  "tipTotalPoints",
])
const ADDON_POST_QUERY_STATUSES = new Set<AddonPostRecord["status"]>([
  "NORMAL",
  "PENDING",
  "LOCKED",
  "OFFLINE",
])

const addonUserSelect = {
  id: true,
  username: true,
  nickname: true,
  avatarPath: true,
  status: true,
  vipLevel: true,
} satisfies Prisma.UserSelect

const addonPostRecordSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  content: true,
  coverPath: true,
  type: true,
  status: true,
  reviewNote: true,
  isAnonymous: true,
  isPinned: true,
  pinScope: true,
  isFeatured: true,
  commentsVisibleToAuthorOnly: true,
  minViewLevel: true,
  minViewVipLevel: true,
  commentCount: true,
  viewCount: true,
  likeCount: true,
  favoriteCount: true,
  tipCount: true,
  tipTotalPoints: true,
  bountyPoints: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  lastCommentedAt: true,
  activityAt: true,
  board: {
    select: {
      id: true,
      slug: true,
      name: true,
      iconPath: true,
      zone: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  },
  author: {
    select: addonUserSelect,
  },
} satisfies Prisma.PostSelect

type AddonPostQueryRow = Prisma.PostGetPayload<{ select: typeof addonPostRecordSelect }>

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
      .map((item) => normalizeOptionalString(item))
      .filter(Boolean)
    : []
}

function normalizeUniqueStringArray(value: unknown) {
  return [...new Set(normalizeStringArray(value))]
}

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number) {
  const normalized = typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : Number.parseInt(String(value ?? ""), 10)

  if (!Number.isFinite(normalized)) {
    return fallback
  }

  return Math.max(0, Math.min(max, normalized))
}

function normalizeOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseOptionalIsoDate(value: unknown, label: string) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} 必须是合法的 ISO 日期时间字符串`)
  }

  return parsed
}

function normalizeStatusMode(value: unknown): AddonPostStatusMode {
  switch (normalizeOptionalString(value).toUpperCase()) {
    case "PUBLISHED":
      return "PUBLISHED"
    case "PENDING":
      return "PENDING"
    default:
      return "AUTO"
  }
}

function buildAddonRuntimeRequest(
  addon: LoadedAddonRuntime,
  runtimePath: string,
  request?: Request,
) {
  const origin = request
    ? new URL(request.url).origin
    : "http://localhost"

  return new Request(
    new URL(`${addon.publicApiBaseUrl}/${runtimePath.replace(/^\/+/, "")}`, origin).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rhex-addon-id": addon.manifest.id,
      },
    },
  )
}

function buildPostCreateBody(input: AddonPostCreateInput) {
  return {
    title: normalizeOptionalString(input.title),
    content: normalizeOptionalString(input.content),
    boardSlug: normalizeOptionalString(input.boardSlug),
    postType: normalizeOptionalString(input.postType, "NORMAL").toUpperCase(),
    isAnonymous: Boolean(input.isAnonymous),
    coverPath: normalizeOptionalString(input.coverPath),
    bountyPoints: typeof input.bountyPoints === "number" ? input.bountyPoints : undefined,
    auctionConfig: input.auctionConfig ?? undefined,
    pollOptions: Array.isArray(input.pollOptions)
      ? input.pollOptions.filter((item): item is string => typeof item === "string")
      : undefined,
    pollExpiresAt: normalizeOptionalString(input.pollExpiresAt) || undefined,
    commentsVisibleToAuthorOnly: Boolean(input.commentsVisibleToAuthorOnly),
    loginUnlockContent: normalizeOptionalString(input.loginUnlockContent),
    replyUnlockContent: normalizeOptionalString(input.replyUnlockContent),
    replyThreshold: typeof input.replyThreshold === "number" ? input.replyThreshold : undefined,
    purchaseUnlockContent: normalizeOptionalString(input.purchaseUnlockContent),
    purchasePrice: typeof input.purchasePrice === "number" ? input.purchasePrice : undefined,
    minViewLevel: typeof input.minViewLevel === "number" ? input.minViewLevel : 0,
    minViewVipLevel: typeof input.minViewVipLevel === "number" ? input.minViewVipLevel : 0,
    lotteryConfig: input.lotteryConfig ?? undefined,
    redPacketConfig: input.redPacketConfig ?? undefined,
    manualTags: Array.isArray(input.manualTags)
      ? input.manualTags.filter((item): item is string => typeof item === "string")
      : undefined,
    attachments: Array.isArray(input.attachments) ? input.attachments : undefined,
  }
}

function mapAddonZoneSummary(
  zone: AddonPostQueryRow["board"]["zone"],
): AddonZoneSummary | null {
  if (!zone) {
    return null
  }

  return {
    id: zone.id,
    slug: zone.slug,
    name: zone.name,
  }
}

function mapAddonBoardSummary(board: AddonPostQueryRow["board"]): AddonBoardSummary {
  return {
    id: board.id,
    slug: board.slug,
    name: board.name,
    iconPath: board.iconPath,
    zone: mapAddonZoneSummary(board.zone),
  }
}

function mapAddonUserSummary(user: AddonPostQueryRow["author"]): AddonUserSummary {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    displayName: getUserDisplayName(user),
    avatarPath: user.avatarPath,
    status: user.status,
    vipLevel: user.vipLevel ?? 0,
  }
}

function mapAddonPostRecord(post: AddonPostQueryRow): AddonPostRecord {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    content: post.content,
    coverPath: post.coverPath,
    type: post.type,
    status: post.status,
    reviewNote: post.reviewNote,
    isAnonymous: post.isAnonymous,
    isPinned: post.isPinned,
    pinScope: post.pinScope,
    isFeatured: post.isFeatured,
    commentsVisibleToAuthorOnly: post.commentsVisibleToAuthorOnly,
    minViewLevel: post.minViewLevel,
    minViewVipLevel: post.minViewVipLevel,
    commentCount: post.commentCount,
    viewCount: post.viewCount,
    likeCount: post.likeCount,
    favoriteCount: post.favoriteCount,
    tipCount: post.tipCount,
    tipTotalPoints: post.tipTotalPoints,
    bountyPoints: post.bountyPoints,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    lastCommentedAt: post.lastCommentedAt?.toISOString() ?? null,
    activityAt: post.activityAt.toISOString(),
    board: mapAddonBoardSummary(post.board),
    author: mapAddonUserSummary(post.author),
  }
}

function normalizeSortDirection(value: unknown, fallback: AddonSortDirection = "desc"): AddonSortDirection {
  return normalizeOptionalString(value).toLowerCase() === "asc" ? "asc" : fallback
}

function normalizePostQuerySort(sort: AddonPostQuerySort[] | undefined) {
  const normalized = (Array.isArray(sort) ? sort : [])
    .flatMap((item) => {
      const field = normalizeOptionalString(item?.field)
      if (!field || !ADDON_POST_QUERY_SORT_FIELDS.has(field as AddonPostQuerySort["field"])) {
        return []
      }

      return [{
        field: field as AddonPostQuerySort["field"],
        direction: normalizeSortDirection(item?.direction),
      }]
    })

  return normalized.length > 0
    ? normalized
    : [{ field: "activityAt", direction: "desc" as const }]
}

function buildPostOrderBy(sort: AddonPostQuerySort[] | undefined): Prisma.PostOrderByWithRelationInput[] {
  const orderBy = normalizePostQuerySort(sort).map((item) => ({
    [item.field]: item.direction,
  })) as Prisma.PostOrderByWithRelationInput[]

  if (!orderBy.some((item) => "createdAt" in item)) {
    orderBy.push({ createdAt: "desc" })
  }

  return orderBy
}

function buildPostDateFilter(
  field: "createdAt" | "updatedAt" | "publishedAt" | "activityAt",
  afterValue: unknown,
  beforeValue: unknown,
): Prisma.PostWhereInput | null {
  const after = parseOptionalIsoDate(afterValue, `${field}.after`)
  const before = parseOptionalIsoDate(beforeValue, `${field}.before`)

  if (after && before && after.getTime() > before.getTime()) {
    throw new Error(`${field}.after 不能晚于 ${field}.before`)
  }

  if (!after && !before) {
    return null
  }

  const filter: Prisma.DateTimeNullableFilter = {}
  if (after) {
    filter.gte = after
  }
  if (before) {
    filter.lte = before
  }

  return {
    [field]: filter,
  } satisfies Prisma.PostWhereInput
}

function buildLastCommentedFilter(options: AddonPostQueryOptions): Prisma.PostWhereInput | null {
  const after = parseOptionalIsoDate(options.lastCommentedAfter, "lastCommentedAt.after")
  const before = parseOptionalIsoDate(options.lastCommentedBefore, "lastCommentedAt.before")

  if (after && before && after.getTime() > before.getTime()) {
    throw new Error("lastCommentedAt.after 不能晚于 lastCommentedAt.before")
  }

  if (!after && !before) {
    return null
  }

  if (after) {
    return {
      lastCommentedAt: {
        gte: after,
        ...(before ? { lte: before } : {}),
      },
    }
  }

  return {
    OR: [
      { lastCommentedAt: null },
      {
        lastCommentedAt: {
          lte: before!,
        },
      },
    ],
  }
}

function buildPostNumericRange(field: keyof Pick<
  AddonPostRecord,
  "commentCount" | "viewCount" | "likeCount" | "favoriteCount"
>, minValue: unknown, maxValue: unknown): Prisma.PostWhereInput | null {
  const min = normalizeOptionalNumber(minValue)
  const max = normalizeOptionalNumber(maxValue)

  if (min === null && max === null) {
    return null
  }

  if (min !== null && max !== null && min > max) {
    throw new Error(`${String(field)} 的最小值不能大于最大值`)
  }

  return {
    [field]: {
      ...(min !== null ? { gte: min } : {}),
      ...(max !== null ? { lte: max } : {}),
    },
  } satisfies Prisma.PostWhereInput
}

function buildPostWhere(options: AddonPostQueryOptions = {}): Prisma.PostWhereInput {
  const andWhere: Prisma.PostWhereInput[] = [
    {
      board: {
        status: BoardStatus.ACTIVE,
      },
    },
  ]

  const ids = normalizeUniqueStringArray(options.ids)
  if (ids.length > 0) {
    andWhere.push({
      id: {
        in: ids,
      },
    })
  }

  const excludeIds = normalizeUniqueStringArray(options.excludeIds)
  if (excludeIds.length > 0) {
    andWhere.push({
      id: {
        notIn: excludeIds,
      },
    })
  }

  const boardIds = normalizeUniqueStringArray(options.boardIds)
  if (boardIds.length > 0) {
    andWhere.push({
      boardId: {
        in: boardIds,
      },
    })
  }

  const boardSlugs = normalizeUniqueStringArray(options.boardSlugs)
  if (boardSlugs.length > 0) {
    andWhere.push({
      board: {
        slug: {
          in: boardSlugs,
        },
      },
    })
  }

  const zoneIds = normalizeUniqueStringArray(options.zoneIds)
  if (zoneIds.length > 0) {
    andWhere.push({
      board: {
        zoneId: {
          in: zoneIds,
        },
      },
    })
  }

  const zoneSlugs = normalizeUniqueStringArray(options.zoneSlugs)
  if (zoneSlugs.length > 0) {
    andWhere.push({
      board: {
        zone: {
          slug: {
            in: zoneSlugs,
          },
        },
      },
    })
  }

  const authorIds = (Array.isArray(options.authorIds) ? options.authorIds : [])
    .filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0)
  if (authorIds.length > 0) {
    andWhere.push({
      authorId: {
        in: [...new Set(authorIds)],
      },
    })
  }

  const authorUsernames = normalizeUniqueStringArray(options.authorUsernames)
  if (authorUsernames.length > 0) {
    andWhere.push({
      author: {
        username: {
          in: authorUsernames,
        },
      },
    })
  }

  const statuses = normalizeUniqueStringArray(options.statuses)
    .filter((item): item is AddonPostRecord["status"] => ADDON_POST_QUERY_STATUSES.has(item as AddonPostRecord["status"]))
  andWhere.push({
    status: {
      in: (statuses.length > 0 ? statuses : [PostStatus.NORMAL]) as PostStatus[],
    },
  })

  if (options.includePinned === false) {
    andWhere.push({
      isPinned: false,
    })
  }

  if (options.includeFeatured === false) {
    andWhere.push({
      isFeatured: false,
    })
  }

  const dateFilters = [
    buildPostDateFilter("createdAt", options.createdAfter, options.createdBefore),
    buildPostDateFilter("publishedAt", options.publishedAfter, options.publishedBefore),
    buildPostDateFilter("activityAt", options.activityAfter, options.activityBefore),
    buildLastCommentedFilter(options),
    buildPostNumericRange("commentCount", options.minCommentCount, options.maxCommentCount),
    buildPostNumericRange("viewCount", options.minViewCount, options.maxViewCount),
    buildPostNumericRange("likeCount", options.minLikeCount, options.maxLikeCount),
    buildPostNumericRange("favoriteCount", options.minFavoriteCount, options.maxFavoriteCount),
  ].filter((item): item is Prisma.PostWhereInput => Boolean(item))

  andWhere.push(...dateFilters)

  return andWhere.length === 1
    ? andWhere[0]
    : { AND: andWhere }
}

export async function createAddonPost(
  addon: LoadedAddonRuntime,
  input: AddonPostCreateInput,
  request?: Request,
): Promise<AddonPostCreateResult> {
  const author = await resolveAddonActor({
    userId: input.authorId,
    username: input.authorUsername,
    label: "发布账号",
  })
  const body = buildPostCreateBody(input)
  const result = await executePostCreation(body, {
    request: buildAddonRuntimeRequest(addon, "__internal/posts/create", request),
    author,
    statusMode: normalizeStatusMode(input.status),
    log: {
      scope: "addon-posts-create",
      action: "addon-create-post",
      extra: {
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
      },
    },
  })

  return {
    id: result.post.id,
    slug: result.post.slug,
    status: result.post.status,
    boardId: result.post.boardId,
    authorId: result.author.id,
    shouldPending: result.shouldPending,
    contentAdjusted: result.contentAdjusted,
  }
}

export async function queryAddonPosts(options: AddonPostQueryOptions = {}): Promise<AddonPostQueryResult> {
  const limit = normalizeNonNegativeInteger(options.limit, DEFAULT_POST_QUERY_LIMIT, MAX_POST_QUERY_LIMIT) || DEFAULT_POST_QUERY_LIMIT
  const offset = normalizeNonNegativeInteger(options.offset, 0, 100_000)
  const where = buildPostWhere(options)
  const orderBy = buildPostOrderBy(options.sort)
  const includeTotal = Boolean(options.includeTotal)

  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      select: addonPostRecordSelect,
    }),
    includeTotal ? prisma.post.count({ where }) : Promise.resolve(null),
  ])

  return {
    items: items.map((item) => mapAddonPostRecord(item)),
    total,
    limit,
    offset,
  }
}

export async function likeAddonPost(
  addon: LoadedAddonRuntime,
  input: AddonPostLikeInput,
  request?: Request,
): Promise<AddonPostLikeResult> {
  const actor = await resolveAddonActor({
    userId: input.actorId,
    username: input.actorUsername,
    label: "点赞账号",
  })

  return ensurePostLiked({
    actor,
    postId: normalizeOptionalString(input.postId),
    request,
    log: {
      scope: "addon-posts-like",
      action: "addon-like-post",
      extra: {
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
      },
    },
  })
}

export async function tipAddonPost(
  addon: LoadedAddonRuntime,
  input: AddonPostTipInput,
): Promise<AddonPostTipResult> {
  const sender = await resolveAddonActor({
    userId: input.senderId,
    username: input.senderUsername,
    label: "打赏账号",
  })

  assertAddonActorStatus(sender, {
    allowMuted: true,
    mutedMessage: "当前账号状态不可进行打赏",
    bannedMessage: "当前账号状态不可进行打赏",
  })

  return withWriteGuard({
    ...createWriteGuardOptions("posts-tip", {
      userId: sender.id,
      input: {
        postId: normalizeOptionalString(input.postId),
        amount: input.amount,
        giftId: normalizeOptionalString(input.giftId),
      },
    }),
    identity: {
      userId: sender.id,
    },
  }, async () => {
    const result = await tipPost({
      postId: normalizeOptionalString(input.postId),
      senderId: sender.id,
      amount: typeof input.amount === "number" ? input.amount : Number(input.amount),
      giftId: normalizeOptionalString(input.giftId) || undefined,
    })

    revalidateUserSurfaceCache(sender.id)
    revalidateUserSurfaceCache(result.recipientUserId)

    return {
      postId: normalizeOptionalString(input.postId),
      amount: result.amount,
      pointName: result.pointName,
      recipientUserId: result.recipientUserId,
      gift: result.gift
        ? {
            id: result.gift.id,
            name: result.gift.name,
            price: result.gift.price,
          }
        : null,
    }
  })
}
