import { exchangeOAuthToken } from "@/lib/oauth-server"
import { oauthErrorResponse, oauthJsonResponse } from "@/lib/oauth-route"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const token = await exchangeOAuthToken({
      authorizationHeader: request.headers.get("authorization"),
      formData,
    })

    return oauthJsonResponse(token)
  } catch (error) {
    return oauthErrorResponse(error, "签发 OAuth token 失败")
  }
}
