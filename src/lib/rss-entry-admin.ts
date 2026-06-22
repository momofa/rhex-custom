import { resolvePagination } from "@/db/helpers"
import { RssEntryReviewStatus } from "@/db/types"
import type { Prisma } from "@/db/types"
import {
  countRssEntriesByReviewStatus,
  countRssEntriesForAdmin,
  deleteManyRssEntries,
  deleteRssEntryRecord,
  findRssEntryById,
  listRssEntriesPage,
  listRssEntrySourceOptions,
  updateRssEntryRecord,
} from "@/db/rss-entry-admin-queries"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { apiError } from "@/lib/api-route"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { normalizePageSize, normalizePositiveInteger, normalizeText, normalizeTrimmedText } from "@/lib/shared/normalizers"
import { normalizeHttpUrl } from "@/lib/shared/url"

const RSS_ENTRY_PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const RSS_ENTRY_DEFAULT_PAGE_SIZE = 20

async function ensureCanManageRssEntries() {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.apps.manage",
    "无权限管理 RSS 采集数据",
  )
}

export interface RssEntryAdminListItem {
  id: string
  sourceId: string
  sourceName: string
  guid: string | null
  linkUrl: string | null
  title: string
  author: string | null
  summary: string | null
  contentHtml: string | null
  contentText: string | null
  publishedAt: string | null
  reviewStatus: string
  reviewNote: string | null
  reviewedAt: string | null
  reviewerName: string | null
  createdAt: string
  updatedAt: string
}

export interface RssEntryAdminPageData {
  entries: RssEntryAdminListItem[]
  sourceOptions: Array<{
    id: string
    siteName: string
  }>
  filters: {
    keyword: string
    sourceId: string
    reviewStatus: string
  }
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

export interface RssEntryAdminQuery {
  keyword?: unknown
  sourceId?: unknown
  reviewStatus?: unknown
  page?: unknown
  pageSize?: unknown
}

function normalizeReviewStatus(value: unknown) {
  const normalized = normalizeText(value).toUpperCase()
  return normalized === "APPROVED" || normalized === "REJECTED" || normalized === "PENDING" ? normalized : "ALL"
}

function normalizeEntryIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return Array.from(new Set(
    value
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter(Boolean),
  )).slice(0, 200)
}

function normalizePublishedAtInput(value: unknown) {
  const text = normalizeText(value)
  if (!text) {
    return null
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    apiError(400, "发布时间格式不正确")
  }

  return date
}

function normalizeOptionalAbsoluteUrl(value: unknown) {
  const text = normalizeText(value)
  if (!text) {
    return null
  }

  const normalized = normalizeHttpUrl(text, { clearHash: true })
  if (!normalized) {
    apiError(400, "链接地址只支持 http 或 https")
  }

  return normalized
}

function buildWhereInput(query: {
  keyword: string
  sourceId: string
  reviewStatus: string
}): Prisma.RssEntryWhereInput {
  const and: Prisma.RssEntryWhereInput[] = []

  if (query.sourceId) {
    and.push({ sourceId: query.sourceId })
  }

  if (query.reviewStatus !== "ALL") {
    and.push({ reviewStatus: query.reviewStatus as RssEntryReviewStatus })
  }

  if (query.keyword) {
    and.push({
      OR: [
        { title: { contains: query.keyword, mode: "insensitive" } },
        { summary: { contains: query.keyword, mode: "insensitive" } },
        { contentText: { contains: query.keyword, mode: "insensitive" } },
        { author: { contains: query.keyword, mode: "insensitive" } },
        { linkUrl: { contains: query.keyword, mode: "insensitive" } },
        { source: { siteName: { contains: query.keyword, mode: "insensitive" } } },
      ],
    })
  }

  return and.length > 0 ? { AND: and } : {}
}

function mapEntryItem(record: Awaited<ReturnType<typeof listRssEntriesPage>>[number]): RssEntryAdminListItem {
  return {
    id: record.id,
    sourceId: record.sourceId,
    sourceName: record.source.siteName,
    guid: record.guid ?? null,
    linkUrl: record.linkUrl ?? null,
    title: record.title,
    author: record.author ?? null,
    summary: record.summary ?? null,
    contentHtml: record.contentHtml ?? null,
    contentText: record.contentText ?? null,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    reviewStatus: record.reviewStatus,
    reviewNote: record.reviewNote ?? null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewerName: record.reviewer ? (record.reviewer.nickname ?? record.reviewer.username) : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export async function getRssEntryAdminPageData(query: RssEntryAdminQuery = {}): Promise<RssEntryAdminPageData> {
  await ensureCanManageRssEntries()

  const normalized = {
    keyword: normalizeTrimmedText(query.keyword, 100),
    sourceId: normalizeText(query.sourceId),
    reviewStatus: normalizeReviewStatus(query.reviewStatus),
    page: normalizePositiveInteger(query.page, 1),
    pageSize: normalizePageSize(query.pageSize, RSS_ENTRY_PAGE_SIZE_OPTIONS, RSS_ENTRY_DEFAULT_PAGE_SIZE),
  }

  const where = buildWhereInput(normalized)
  const [sourceOptions, total, pending, approved, rejected] = await Promise.all([
    listRssEntrySourceOptions(),
    countRssEntriesForAdmin(where),
    countRssEntriesByReviewStatus(where, RssEntryReviewStatus.PENDING),
    countRssEntriesByReviewStatus(where, RssEntryReviewStatus.APPROVED),
    countRssEntriesByReviewStatus(where, RssEntryReviewStatus.REJECTED),
  ])

  const pagination = resolvePagination({ page: normalized.page, pageSize: normalized.pageSize }, total, RSS_ENTRY_PAGE_SIZE_OPTIONS, RSS_ENTRY_DEFAULT_PAGE_SIZE)
  const entries = await listRssEntriesPage(where, pagination.skip, pagination.pageSize)

  return {
    entries: entries.map(mapEntryItem),
    sourceOptions,
    filters: {
      keyword: normalized.keyword,
      sourceId: normalized.sourceId,
      reviewStatus: normalized.reviewStatus,
    },
    summary: {
      total,
      pending,
      approved,
      rejected,
    },
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    },
  }
}

export async function updateRssEntry(input: {
  entryId: unknown
  title: unknown
  linkUrl?: unknown
  author?: unknown
  summary?: unknown
  contentHtml?: unknown
  contentText?: unknown
  publishedAt?: unknown
  reviewStatus?: unknown
  reviewNote?: unknown
  adminUserId?: number
}) {
  await ensureCanManageRssEntries()

  const entryId = normalizeText(input.entryId)
  if (!entryId) {
    apiError(400, "缺少条目 ID")
  }

  const existing = await findRssEntryById(entryId)
  if (!existing) {
    apiError(404, "采集数据不存在")
  }

  const title = normalizeTrimmedText(input.title, 300)
  if (!title) {
    apiError(400, "标题不能为空")
  }

  const reviewStatus = normalizeReviewStatus(input.reviewStatus)
  const reviewedStatus = reviewStatus === "ALL" ? existing.reviewStatus : reviewStatus
  const reviewedAt = reviewedStatus === "PENDING" ? null : new Date()

  return updateRssEntryRecord(entryId, {
    title,
    linkUrl: normalizeOptionalAbsoluteUrl(input.linkUrl),
    author: normalizeTrimmedText(input.author, 120) || null,
    summary: normalizeTrimmedText(input.summary, 4000) || null,
    contentHtml: normalizeTrimmedText(input.contentHtml, 50000) || null,
    contentText: normalizeTrimmedText(input.contentText, 50000) || null,
    publishedAt: normalizePublishedAtInput(input.publishedAt),
    reviewStatus: reviewedStatus as RssEntryReviewStatus,
    reviewNote: normalizeTrimmedText(input.reviewNote, 500) || null,
    reviewedAt,
    reviewer: reviewedStatus === "PENDING"
      ? { disconnect: true }
      : input.adminUserId
        ? { connect: { id: input.adminUserId } }
        : undefined,
  })
}

export async function reviewRssEntry(input: {
  entryId: unknown
  reviewStatus: unknown
  reviewNote?: unknown
  adminUserId: number
}) {
  await ensureCanManageRssEntries()

  const entryId = normalizeText(input.entryId)
  if (!entryId) {
    apiError(400, "缺少条目 ID")
  }

  const existing = await findRssEntryById(entryId)
  if (!existing) {
    apiError(404, "采集数据不存在")
  }

  const reviewStatus = normalizeReviewStatus(input.reviewStatus)
  if (reviewStatus === "ALL") {
    apiError(400, "审核状态不正确")
  }

  return updateRssEntryRecord(entryId, {
    reviewStatus: reviewStatus as RssEntryReviewStatus,
    reviewNote: normalizeTrimmedText(input.reviewNote, 500) || null,
    reviewedAt: reviewStatus === "PENDING" ? null : new Date(),
    reviewer: reviewStatus === "PENDING"
      ? { disconnect: true }
      : { connect: { id: input.adminUserId } },
  })
}

export async function deleteRssEntry(entryId: string) {
  await ensureCanManageRssEntries()

  const normalizedId = normalizeText(entryId)
  if (!normalizedId) {
    apiError(400, "缺少条目 ID")
  }

  const existing = await findRssEntryById(normalizedId)
  if (!existing) {
    apiError(404, "采集数据不存在")
  }

  await deleteRssEntryRecord(normalizedId)
  return existing
}

export async function batchReviewRssEntries(input: {
  entryIds: unknown
  reviewStatus: unknown
  reviewNote?: unknown
  adminUserId: number
}) {
  await ensureCanManageRssEntries()

  const ids = normalizeEntryIds(input.entryIds)
  if (ids.length === 0) {
    apiError(400, "请至少选择一条采集数据")
  }

  const reviewStatus = normalizeReviewStatus(input.reviewStatus)
  if (reviewStatus === "ALL") {
    apiError(400, "审核状态不正确")
  }

  const reviewNote = normalizeTrimmedText(input.reviewNote, 500) || null
  const reviewedAt = reviewStatus === "PENDING" ? null : new Date()
  const results = await Promise.all(ids.map((id) => updateRssEntryRecord(id, {
    reviewStatus: reviewStatus as RssEntryReviewStatus,
    reviewNote,
    reviewedAt,
    reviewer: reviewStatus === "PENDING"
      ? { disconnect: true }
      : { connect: { id: input.adminUserId } },
  })))

  return {
    count: results.length,
    ids,
  }
}

export async function batchDeleteRssEntries(entryIds: unknown) {
  await ensureCanManageRssEntries()

  const ids = normalizeEntryIds(entryIds)
  if (ids.length === 0) {
    apiError(400, "请至少选择一条采集数据")
  }

  const result = await deleteManyRssEntries({
    id: {
      in: ids,
    },
  })

  return {
    count: result.count,
    ids,
  }
}
