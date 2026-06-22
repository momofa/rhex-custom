import { apiError, apiSuccess, createRouteHandler } from "@/lib/api-route"
import { buildHookedPostStreamDisplayItems } from "@/lib/addon-feed-posts"
import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission } from "@/lib/board-access"
import { getBoardBySlug, getBoardPosts } from "@/lib/boards"
import { normalizeTaxonomyPostSort } from "@/lib/forum-taxonomy-sort"
import { resolveContentVisibleAdminActor } from "@/lib/admin-scope-permissions"
import { DEFAULT_ALLOWED_POST_TYPES, normalizePostTypes } from "@/lib/post-types"
import { getSiteSettings } from "@/lib/site-settings"

interface BoardPostsRouteContext {
  params: Promise<{
    slug: string
  }>
}

function parsePage(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("page") ?? "1")
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1
}

function parseSort(request: Request) {
  return normalizeTaxonomyPostSort(new URL(request.url).searchParams.get("sort") ?? undefined)
}

export const GET = createRouteHandler(async ({ request, routeContext }) => {
  const params = await (routeContext as BoardPostsRouteContext | undefined)?.params
  const slug = decodeURIComponent(params?.slug ?? "").trim()

  if (!slug) {
    apiError(400, "缺少节点标识")
  }

  const [board, currentUser, settings] = await Promise.all([getBoardBySlug(slug), getCurrentUser(), getSiteSettings()])

  if (!board) {
    apiError(404, "节点不存在")
  }

  const permission = checkBoardPermission(currentUser, {
    postPointDelta: 0,
    replyPointDelta: 0,
    postIntervalSeconds: 120,
    replyIntervalSeconds: 3,
    allowedPostTypes: board.allowedPostTypes?.length ? normalizePostTypes(board.allowedPostTypes.join(",")) : DEFAULT_ALLOWED_POST_TYPES,
    allowUserPost: board.allowUserPost ?? true,
    allowUserReply: board.allowUserReply ?? true,
    allowPostAuthorOfflineComment: board.allowPostAuthorOfflineComment ?? false,
    allowUserOfflineOwnComment: board.allowUserOfflineOwnComment ?? false,
    minViewPoints: board.minViewPoints ?? 0,
    minViewLevel: board.minViewLevel ?? 0,
    minPostPoints: board.minPostPoints ?? 0,
    minPostLevel: board.minPostLevel ?? 0,
    minReplyPoints: board.minReplyPoints ?? 0,
    minReplyLevel: board.minReplyLevel ?? 0,
    minViewVipLevel: board.minViewVipLevel ?? 0,
    minPostVipLevel: board.minPostVipLevel ?? 0,
    minReplyVipLevel: board.minReplyVipLevel ?? 0,
    postRequiredVerificationTypeIds: [],
    postRequiredBadgeIds: [],
    replyRequiredVerificationTypeIds: [],
    replyRequiredBadgeIds: [],
    requirePostReview: board.requirePostReview ?? false,
    requireCommentReview: board.requireCommentReview ?? false,
    showInHomeFeed: true,
  }, "view", settings.pointName)

  if (!permission.allowed) {
    apiError(403, permission.message || "当前没有访问权限")
  }

  const currentSort = parseSort(request)
  const result = await getBoardPosts(slug, parsePage(request), settings.boardPostPageSize, currentSort, {
    userId: currentUser?.id ?? null,
    adminActor: await resolveContentVisibleAdminActor(currentUser),
  })

  return apiSuccess({
    ...result,
    items: await buildHookedPostStreamDisplayItems({
      posts: result.items,
      settings,
      sort: currentSort,
      listDisplayMode: board.postListDisplayMode,
      visiblePinScopes: ["GLOBAL", "ZONE", "BOARD"],
      pathname: `/boards/${slug}`,
      request,
      searchParams: new URL(request.url).searchParams,
    }),
  })
}, {
  errorMessage: "获取节点帖子失败",
  logPrefix: "[api/boards/[slug]/posts] unexpected error",
})
