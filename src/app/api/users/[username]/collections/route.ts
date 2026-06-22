import { apiError, apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getPublicFavoriteCollectionsByUsername } from "@/lib/favorite-collections"

interface UserCollectionsRouteContext {
  params: Promise<{
    username: string
  }>
}

function parsePage(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("page") ?? "1")
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1
}

export const GET = createRouteHandler(async ({ request, routeContext }) => {
  const params = await (routeContext as UserCollectionsRouteContext | undefined)?.params
  const username = decodeURIComponent(params?.username ?? "").trim()

  if (!username) {
    apiError(400, "缺少用户名")
  }

  const data = await getPublicFavoriteCollectionsByUsername(username, {
    page: parsePage(request),
  })

  return apiSuccess(data)
}, {
  errorMessage: "公开合集加载失败",
  logPrefix: "[api/users/[username]/collections:GET] unexpected error",
})
