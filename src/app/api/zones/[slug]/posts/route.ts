import { apiError, apiSuccess, createRouteHandler } from "@/lib/api-route"
import { buildHookedPostStreamDisplayItems } from "@/lib/addon-feed-posts"
import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission } from "@/lib/board-access"
import { normalizeTaxonomyPostSort } from "@/lib/forum-taxonomy-sort"
import { resolveContentVisibleAdminActor } from "@/lib/admin-scope-permissions"
import { DEFAULT_ALLOWED_POST_TYPES } from "@/lib/post-types"
import { getSiteSettings } from "@/lib/site-settings"
import { getZoneBySlug, getZonePosts } from "@/lib/zones"

interface ZonePostsRouteContext {
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
  const params = await (routeContext as ZonePostsRouteContext | undefined)?.params
  const slug = decodeURIComponent(params?.slug ?? "").trim()

  if (!slug) {
    apiError(400, "缺少分区标识")
  }

  const [zone, currentUser, settings] = await Promise.all([getZoneBySlug(slug), getCurrentUser(), getSiteSettings()])

  if (!zone) {
    apiError(404, "分区不存在")
  }

  const permission = checkBoardPermission(currentUser, {
    postPointDelta: 0,
    replyPointDelta: 0,
    postIntervalSeconds: 120,
    replyIntervalSeconds: 3,
    allowedPostTypes: DEFAULT_ALLOWED_POST_TYPES,
    allowUserPost: zone.allowUserPost ?? true,
    allowUserReply: zone.allowUserReply ?? true,
    allowPostAuthorOfflineComment: zone.allowPostAuthorOfflineComment ?? false,
    allowUserOfflineOwnComment: zone.allowUserOfflineOwnComment ?? false,
    minViewPoints: zone.minViewPoints ?? 0,
    minViewLevel: zone.minViewLevel ?? 0,
    minPostPoints: 0,
    minPostLevel: 0,
    minReplyPoints: 0,
    minReplyLevel: 0,
    minViewVipLevel: zone.minViewVipLevel ?? 0,
    minPostVipLevel: 0,
    minReplyVipLevel: 0,
    postRequiredVerificationTypeIds: [],
    postRequiredBadgeIds: [],
    replyRequiredVerificationTypeIds: [],
    replyRequiredBadgeIds: [],
    requirePostReview: zone.requirePostReview ?? false,
    requireCommentReview: zone.requireCommentReview ?? false,
    showInHomeFeed: true,
  }, "view", settings.pointName)

  if (!permission.allowed) {
    apiError(403, permission.message || "当前没有访问权限")
  }

  const currentSort = parseSort(request)
  const result = await getZonePosts(slug, parsePage(request), settings.zonePostPageSize, currentSort, {
    userId: currentUser?.id ?? null,
    adminActor: await resolveContentVisibleAdminActor(currentUser),
  })

  return apiSuccess({
    ...result,
    items: await buildHookedPostStreamDisplayItems({
      posts: result.items,
      settings,
      sort: currentSort,
      listDisplayMode: zone.postListDisplayMode,
      visiblePinScopes: ["GLOBAL", "ZONE"],
      pathname: `/zones/${slug}`,
      request,
      searchParams: new URL(request.url).searchParams,
    }),
  })
}, {
  errorMessage: "获取分区帖子失败",
  logPrefix: "[api/zones/[slug]/posts] unexpected error",
})
