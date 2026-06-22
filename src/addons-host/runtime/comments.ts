import "server-only"

import { prisma } from "@/db/client"
import { CommentStatus, type Prisma } from "@/db/types"
import { executeCommentCreation } from "@/lib/comment-create-execution"
import { ensureCommentLiked } from "@/lib/interaction-like-execution"
import { getUserDisplayName } from "@/lib/user-display"
import { resolveAddonActor } from "@/addons-host/runtime/actors"
import type {
  AddonCommentCreateInput,
  AddonCommentCreateResult,
  AddonCommentLikeInput,
  AddonCommentLikeResult,
  AddonCommentQueryOptions,
  AddonCommentQueryResult,
  AddonCommentQuerySort,
  AddonCommentRecord,
  AddonSortDirection,
  AddonUserSummary,
  LoadedAddonRuntime,
} from "@/addons-host/types"

const DEFAULT_COMMENT_QUERY_LIMIT = 50
const MAX_COMMENT_QUERY_LIMIT = 500
const ADDON_COMMENT_QUERY_SORT_FIELDS = new Set<AddonCommentQuerySort["field"]>([
  "createdAt",
  "updatedAt",
  "likeCount",
])
const ADDON_COMMENT_QUERY_STATUSES = new Set<AddonCommentRecord["status"]>([
  "NORMAL",
  "HIDDEN",
  "PENDING",
])

const addonCommentUserSelect = {
  id: true,
  username: true,
  nickname: true,
  avatarPath: true,
  status: true,
  vipLevel: true,
} satisfies Prisma.UserSelect

const addonCommentRecordSelect = {
  id: true,
  postId: true,
  parentId: true,
  replyToUserId: true,
  replyToCommentId: true,
  useAnonymousIdentity: true,
  content: true,
  status: true,
  reviewNote: true,
  likeCount: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: addonCommentUserSelect,
  },
} satisfies Prisma.CommentSelect

type AddonCommentQueryRow = Prisma.CommentGetPayload<{ select: typeof addonCommentRecordSelect }>

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

function mapAddonUserSummary(user: AddonCommentQueryRow["user"]): AddonUserSummary {
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

function mapAddonCommentRecord(comment: AddonCommentQueryRow): AddonCommentRecord {
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    replyToUserId: comment.replyToUserId,
    replyToCommentId: comment.replyToCommentId,
    useAnonymousIdentity: comment.useAnonymousIdentity,
    content: comment.content,
    status: comment.status,
    reviewNote: comment.reviewNote,
    likeCount: comment.likeCount,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: mapAddonUserSummary(comment.user),
  }
}

function normalizeSortDirection(value: unknown, fallback: AddonSortDirection = "desc"): AddonSortDirection {
  return normalizeOptionalString(value).toLowerCase() === "asc" ? "asc" : fallback
}

function buildCommentOrderBy(sort: AddonCommentQuerySort[] | undefined): Prisma.CommentOrderByWithRelationInput[] {
  const normalized = (Array.isArray(sort) ? sort : [])
    .flatMap((item) => {
      const field = normalizeOptionalString(item?.field)
      if (!field || !ADDON_COMMENT_QUERY_SORT_FIELDS.has(field as AddonCommentQuerySort["field"])) {
        return []
      }

      return [{
        field: field as AddonCommentQuerySort["field"],
        direction: normalizeSortDirection(item?.direction),
      }]
    })

  const orderBy = (normalized.length > 0
    ? normalized
    : [{ field: "createdAt", direction: "desc" as const }])
    .map((item) => ({
      [item.field]: item.direction,
    })) as Prisma.CommentOrderByWithRelationInput[]

  if (!orderBy.some((item) => "createdAt" in item)) {
    orderBy.push({ createdAt: "desc" })
  }

  return orderBy
}

function buildCommentDateFilter(
  field: "createdAt" | "updatedAt",
  afterValue: unknown,
  beforeValue: unknown,
): Prisma.CommentWhereInput | null {
  const after = parseOptionalIsoDate(afterValue, `${field}.after`)
  const before = parseOptionalIsoDate(beforeValue, `${field}.before`)

  if (after && before && after.getTime() > before.getTime()) {
    throw new Error(`${field}.after 不能晚于 ${field}.before`)
  }

  if (!after && !before) {
    return null
  }

  return {
    [field]: {
      ...(after ? { gte: after } : {}),
      ...(before ? { lte: before } : {}),
    },
  } satisfies Prisma.CommentWhereInput
}

function buildCommentLikeRange(minValue: unknown, maxValue: unknown): Prisma.CommentWhereInput | null {
  const min = normalizeOptionalNumber(minValue)
  const max = normalizeOptionalNumber(maxValue)

  if (min === null && max === null) {
    return null
  }

  if (min !== null && max !== null && min > max) {
    throw new Error("likeCount 的最小值不能大于最大值")
  }

  return {
    likeCount: {
      ...(min !== null ? { gte: min } : {}),
      ...(max !== null ? { lte: max } : {}),
    },
  }
}

function buildCommentWhere(options: AddonCommentQueryOptions = {}): Prisma.CommentWhereInput {
  const andWhere: Prisma.CommentWhereInput[] = []

  const ids = normalizeUniqueStringArray(options.ids)
  if (ids.length > 0) {
    andWhere.push({
      id: {
        in: ids,
      },
    })
  }

  const postId = normalizeOptionalString(options.postId)
  if (postId) {
    andWhere.push({
      postId,
    })
  }

  const postIds = normalizeUniqueStringArray(options.postIds)
  if (postIds.length > 0) {
    andWhere.push({
      postId: {
        in: postIds,
      },
    })
  }

  const authorIds = (Array.isArray(options.authorIds) ? options.authorIds : [])
    .filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0)
  if (authorIds.length > 0) {
    andWhere.push({
      userId: {
        in: [...new Set(authorIds)],
      },
    })
  }

  const authorUsernames = normalizeUniqueStringArray(options.authorUsernames)
  if (authorUsernames.length > 0) {
    andWhere.push({
      user: {
        username: {
          in: authorUsernames,
        },
      },
    })
  }

  const statuses = normalizeUniqueStringArray(options.statuses)
    .filter((item): item is AddonCommentRecord["status"] => ADDON_COMMENT_QUERY_STATUSES.has(item as AddonCommentRecord["status"]))
  andWhere.push({
    status: {
      in: (statuses.length > 0 ? statuses : [CommentStatus.NORMAL]) as CommentStatus[],
    },
  })

  if (Object.prototype.hasOwnProperty.call(options, "parentId")) {
    const parentId = normalizeOptionalString(options.parentId)
    andWhere.push({
      parentId: parentId || null,
    })
  }

  const rangeFilters = [
    buildCommentDateFilter("createdAt", options.createdAfter, options.createdBefore),
    buildCommentDateFilter("updatedAt", options.updatedAfter, options.updatedBefore),
    buildCommentLikeRange(options.minLikeCount, options.maxLikeCount),
  ].filter((item): item is Prisma.CommentWhereInput => Boolean(item))

  andWhere.push(...rangeFilters)

  return andWhere.length === 1
    ? andWhere[0]
    : { AND: andWhere }
}

function buildCommentCreateBody(input: AddonCommentCreateInput) {
  return {
    postId: normalizeOptionalString(input.postId),
    content: normalizeOptionalString(input.content),
    parentId: normalizeOptionalString(input.parentId),
    replyToUserName: normalizeOptionalString(input.replyToUserName),
    replyToCommentId: normalizeOptionalString(input.replyToCommentId),
    useAnonymousIdentity: Boolean(input.useAnonymousIdentity),
    commentView: normalizeOptionalString(input.commentView, "tree") === "flat" ? "flat" : "tree",
  }
}

export async function createAddonComment(
  addon: LoadedAddonRuntime,
  input: AddonCommentCreateInput,
  request?: Request,
): Promise<AddonCommentCreateResult> {
  const author = await resolveAddonActor({
    userId: input.authorId,
    username: input.authorUsername,
    label: "回复账号",
  })

  const result = await executeCommentCreation(buildCommentCreateBody(input), {
    request: buildAddonRuntimeRequest(addon, "__internal/comments/create", request),
    author,
    log: {
      scope: "addon-comments-create",
      action: "addon-create-comment",
      extra: {
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
      },
    },
  })

  return {
    id: result.created.id,
    postId: result.postId,
    status: result.created.status,
    parentId: result.created.parentId ?? null,
    replyToCommentId: result.created.replyToCommentId ?? null,
    replyToUserId: result.created.replyToUserId ?? null,
    reviewRequired: result.reviewRequired,
    contentAdjusted: result.contentAdjusted,
    targetPage: result.targetPage,
    commentView: result.commentView,
  }
}

export async function queryAddonComments(options: AddonCommentQueryOptions = {}): Promise<AddonCommentQueryResult> {
  const limit = normalizeNonNegativeInteger(options.limit, DEFAULT_COMMENT_QUERY_LIMIT, MAX_COMMENT_QUERY_LIMIT) || DEFAULT_COMMENT_QUERY_LIMIT
  const offset = normalizeNonNegativeInteger(options.offset, 0, 100_000)
  const where = buildCommentWhere(options)
  const orderBy = buildCommentOrderBy(options.sort)
  const includeTotal = Boolean(options.includeTotal)

  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      select: addonCommentRecordSelect,
    }),
    includeTotal ? prisma.comment.count({ where }) : Promise.resolve(null),
  ])

  return {
    items: items.map((item) => mapAddonCommentRecord(item)),
    total,
    limit,
    offset,
  }
}

export async function likeAddonComment(
  addon: LoadedAddonRuntime,
  input: AddonCommentLikeInput,
  request?: Request,
): Promise<AddonCommentLikeResult> {
  const actor = await resolveAddonActor({
    userId: input.actorId,
    username: input.actorUsername,
    label: "点赞账号",
  })

  return ensureCommentLiked({
    actor,
    commentId: normalizeOptionalString(input.commentId),
    request,
    log: {
      scope: "addon-comments-like",
      action: "addon-like-comment",
      extra: {
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
      },
    },
  })
}
