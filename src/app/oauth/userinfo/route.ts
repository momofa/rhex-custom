import { resolveOAuthUserinfo } from "@/lib/oauth-server"
import { oauthErrorResponse, oauthJsonResponse } from "@/lib/oauth-route"

export async function GET(request: Request) {
  try {
    const userinfo = await resolveOAuthUserinfo({
      authorizationHeader: request.headers.get("authorization"),
    })

    return oauthJsonResponse(userinfo)
  } catch (error) {
    return oauthErrorResponse(error, "读取 OAuth userinfo 失败")
  }
}
