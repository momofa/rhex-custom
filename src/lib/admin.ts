import { AnnouncementStatus, BoardStatus, PostStatus, ReportStatus, UserRole, UserStatus } from "@/db/types"
import { prisma } from "@/db/client"

import { getCurrentUser } from "@/lib/auth"
import type { AdminPostListResult } from "@/lib/admin-post-management"
import type { AdminPermissionKey } from "@/lib/admin-permission-policy"
export { getRequestIp } from "@/lib/request-ip"

import { getAdminDashboardRawData, getAdminStructureRawData } from "@/db/admin-dashboard-queries"
import { createAdminLogEntry } from "@/db/admin-log-queries"
import { countAdminCommentSummary, findAdminCommentBoardOptions, findAdminCommentsPage } from "@/db/admin-comment-management-queries"
import { countAdminPostSummary, findAdminPostBoardOptions, findAdminPostsPage } from "@/db/admin-post-management-queries"
import {
  buildAdminCommentFilters,
  buildAdminCommentOrderBy,
  buildAdminCommentWhere,
  mapAdminCommentBoardOption,
  mapAdminCommentListItem,
  normalizeAdminCommentQuery,
  type AdminCommentQuery,
} from "@/lib/admin-comment-list"
import {
  buildAdminPostFilters,
  buildAdminPostOrderBy,
  buildAdminPostWhere,
  mapAdminPostBoardOption,
  mapAdminPostListItem,
  normalizeAdminPostQuery,
  type AdminPostQuery,
} from "@/lib/admin-post-list"
import { mapAdminDashboardData, mapAdminStructureData, type AdminDashboardData, type AdminStructureData } from "@/lib/admin-dashboard"
import {
  buildManagedBoardWhereInput,
  buildVisibleStructureZoneWhereInput,
  requireAdminActor,
  requireSiteAdminActor,
  type AdminActor,
} from "@/lib/moderator-permissions"
import { apiError } from "./api-route"
import { getAdminBoardApplicationPageData } from "@/lib/board-applications"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { canAdminWithPermissionOverrides, getAdminPermissionGrants } from "@/lib/admin-permission-overrides"
import { isFounderAdmin } from "@/lib/admin-founder"

export async function requireAdminUser(permission?: AdminPermissionKey) {
  const currentUser = await getCurrentUser()

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return null
  }

  const actor = {
    ...currentUser,
    role: "ADMIN",
    moderatedZoneScopes: [],
    moderatedBoardScopes: [],
  } satisfies AdminActor

  if (permission && !await canAdminWithPermissionOverrides(actor, permission)) {
    return null
  }

  return actor
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const currentUser = await requireSiteAdminActor()

  if (!currentUser) {
    apiError(403, "无权限访问后台数据")
  }
  await ensureAdminActorPermission(currentUser, "admin.overview.view", "无权限访问后台数据")

  const data = await getAdminDashboardRawData()

  return mapAdminDashboardData(data)
}

export async function getAdminStructureData(): Promise<AdminStructureData> {
  const currentUser = await requireAdminActor()

  if (!currentUser) {
    apiError(403, "无权限访问后台版块数据")
  }
  await ensureAdminActorPermission(currentUser, "admin.structure.view", "无权限访问后台版块数据")

  const actorIsFounder = currentUser.role === "ADMIN" ? await isFounderAdmin(currentUser.id) : false
  const adminPermissionGrants = actorIsFounder ? [] : await getAdminPermissionGrants(currentUser.id)
  const canReviewBoardApplications = await canAdminWithPermissionOverrides(currentUser, "admin.operations.manage", { isFounder: actorIsFounder })
  const [data, boardApplications] = await Promise.all([
    getAdminStructureRawData({
      zoneWhere: buildVisibleStructureZoneWhereInput(currentUser),
      boardWhere: buildManagedBoardWhereInput(currentUser),
    }),
    canReviewBoardApplications
      ? getAdminBoardApplicationPageData()
      : Promise.resolve({ pendingCount: 0, items: [] }),
  ])

  return {
    ...mapAdminStructureData(data, currentUser, { isFounder: actorIsFounder, grants: adminPermissionGrants }),
    boardApplications: boardApplications.items,
    canReviewBoardApplications,
  }
}

export async function getAdminBoardApplicationData(): Promise<{
  zones: Array<{ id: string; name: string; slug: string }>
  boardApplications: AdminStructureData["boardApplications"]
  canReviewBoardApplications: boolean
}> {
  const currentUser = await requireSiteAdminActor()

  if (!currentUser) {
    apiError(403, "无权限访问节点申请")
  }
  await ensureAdminActorPermission(currentUser, "admin.operations.manage", "无权限访问节点申请")

  const [zones, boardApplications] = await Promise.all([
    prisma.zone.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    getAdminBoardApplicationPageData(),
  ])

  return {
    zones,
    boardApplications: boardApplications.items,
    canReviewBoardApplications: true,
  }
}

export async function getAdminPosts(query: AdminPostQuery = {}): Promise<AdminPostListResult> {
  const currentUser = await requireAdminActor()

  if (!currentUser) {
    apiError(403, "无权限访问帖子管理")
  }
  await ensureAdminActorPermission(currentUser, "admin.content.manage", "无权限访问帖子管理")

  const normalizedQuery = normalizeAdminPostQuery(query)
  const where = buildAdminPostWhere(currentUser, normalizedQuery)
  const orderBy = buildAdminPostOrderBy(normalizedQuery.sort)

  const [summary, boardOptions] = await Promise.all([
    countAdminPostSummary(where),
    findAdminPostBoardOptions(buildManagedBoardWhereInput(currentUser)),
  ])
  const { total, pending, normal, offline, pinned, featured: featuredCount, announcement: announcementCount } = summary

  const totalPages = Math.max(1, Math.ceil(total / normalizedQuery.pageSize))
  const page = Math.min(normalizedQuery.page, totalPages)
  const skip = (page - 1) * normalizedQuery.pageSize

  const posts = await findAdminPostsPage(where, orderBy, skip, normalizedQuery.pageSize)

  return {
    posts: posts.map(mapAdminPostListItem),
    boardOptions: boardOptions.map(mapAdminPostBoardOption),
    filters: buildAdminPostFilters(normalizedQuery),
    actorRole: currentUser.role,
    summary: {
      total,
      pending,
      normal,
      offline,
      pinned,
      featured: featuredCount,
      announcement: announcementCount,
    },
    pagination: {
      page,
      pageSize: normalizedQuery.pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}

export async function writeAdminLog(adminId: number, action: string, targetType: string, targetId: string, detail?: string, ip?: string | null) {
  await createAdminLogEntry({
    adminId,
    action,
    targetType,
    targetId,
    detail,
    ip,
  })
}

export async function getAdminComments(query: AdminCommentQuery = {}) {
  const currentUser = await requireAdminActor()

  if (!currentUser) {
    apiError(403, "无权限访问评论管理")
  }
  await ensureAdminActorPermission(currentUser, "admin.comments.manage", "无权限访问评论管理")

  const normalizedQuery = normalizeAdminCommentQuery(query)
  const where = buildAdminCommentWhere(currentUser, normalizedQuery)
  const orderBy = buildAdminCommentOrderBy(normalizedQuery.sort)

  const [summary, boardOptions] = await Promise.all([
    countAdminCommentSummary(where),
    findAdminCommentBoardOptions(buildManagedBoardWhereInput(currentUser)),
  ])

  const totalPages = Math.max(1, Math.ceil(summary.total / normalizedQuery.pageSize))
  const page = Math.min(normalizedQuery.page, totalPages)
  const skip = (page - 1) * normalizedQuery.pageSize
  const comments = await findAdminCommentsPage(where, orderBy, skip, normalizedQuery.pageSize)

  return {
    comments: comments.map(mapAdminCommentListItem),
    actorRole: currentUser.role,
    boardOptions: boardOptions.map(mapAdminCommentBoardOption),
    filters: buildAdminCommentFilters(normalizedQuery),
    summary,
    pagination: {
      page,
      pageSize: normalizedQuery.pageSize,
      total: summary.total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}


export const adminEnums = {
  UserRole,
  UserStatus,
  BoardStatus,
  PostStatus,
  ReportStatus,
  AnnouncementStatus,
}

