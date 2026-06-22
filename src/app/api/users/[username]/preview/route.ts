import { apiError, apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getUserPreviewCardData } from "@/lib/user-preview-card"

interface UserPreviewRouteContext {
  params: Promise<{
    username: string
  }>
}

export const GET = createRouteHandler(async ({ routeContext }) => {
  const params = await (routeContext as UserPreviewRouteContext | undefined)?.params
  const username = decodeURIComponent(params?.username ?? "").trim()

  if (!username) {
    apiError(400, "缺少用户名")
  }

  const data = await getUserPreviewCardData(username)

  if (!data) {
    apiError(404, "用户不存在")
  }

  return apiSuccess(data)
}, {
  errorMessage: "用户预览卡加载失败",
  logPrefix: "[api/users/[username]/preview:GET] unexpected error",
})
