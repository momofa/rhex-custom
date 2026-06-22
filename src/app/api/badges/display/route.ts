import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { toggleDisplayedBadge } from "@/lib/badges"
import { revalidateUserBadgeMutation } from "@/lib/badge-cache-revalidation"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const badgeId = String(body.badgeId ?? "").trim()

  if (!badgeId) {
    apiError(400, "缺少勋章参数")
  }

  const result = await toggleDisplayedBadge(currentUser.id, badgeId)
  revalidateUserBadgeMutation(currentUser.id)
  return apiSuccess(result, result.message)
}, {
  errorMessage: "设置失败",
  logPrefix: "[api/badges/display] unexpected error",
  unauthorizedMessage: "请先登录后再设置勋章展示",
  allowStatuses: ["ACTIVE", "MUTED"],
})
