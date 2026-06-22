import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { claimBadge } from "@/lib/badges"
import { revalidateUserBadgeMutation } from "@/lib/badge-cache-revalidation"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const badgeId = String(body.badgeId ?? "").trim()

  if (!badgeId) {
    apiError(400, "缺少勋章参数")
  }

  const badge = await claimBadge(currentUser.id, badgeId)
  revalidateUserBadgeMutation(currentUser.id)
  return apiSuccess(undefined, `已领取勋章：${badge.name}`)
}, {
  errorMessage: "领取失败",
  logPrefix: "[api/badges/claim] unexpected error",
  unauthorizedMessage: "请先登录后再领取勋章",
  allowStatuses: ["ACTIVE", "MUTED"],
})
