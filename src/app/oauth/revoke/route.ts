import { revokeOAuthToken } from "@/lib/oauth-server"
import { oauthErrorResponse, oauthJsonResponse } from "@/lib/oauth-route"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    await revokeOAuthToken({
      authorizationHeader: request.headers.get("authorization"),
      formData,
    })

    return oauthJsonResponse(null, { status: 200 })
  } catch (error) {
    return oauthErrorResponse(error, "撤销 OAuth token 失败")
  }
}
