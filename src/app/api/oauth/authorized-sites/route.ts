import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { revokeOwnOAuthConsent } from "@/lib/oauth-server"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action : ""

  if (action === "revoke") {
    await revokeOwnOAuthConsent({
      userId: currentUser.id,
      clientId: body.clientId,
    })

    return apiSuccess(undefined, "已取消授权")
  }

  apiError(400, "不支持的授权操作")
}, {
  errorMessage: "处理 OAuth 授权失败",
  logPrefix: "[api/oauth/authorized-sites] unexpected error",
  unauthorizedMessage: "请先登录后再管理 OAuth 授权",
  allowStatuses: ["ACTIVE"],
})
