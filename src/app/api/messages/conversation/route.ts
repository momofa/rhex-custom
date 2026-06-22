import { apiSuccess, createUserRouteHandler, requireSearchParam } from "@/lib/api-route"
import { getMessageConversationDetail } from "@/lib/messages"

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const conversationId = requireSearchParam(request, "conversationId", "缺少会话信息")
  const data = await getMessageConversationDetail(currentUser.id, conversationId)

  return apiSuccess(data, "加载成功")
}, {
  errorMessage: "加载会话失败",
  logPrefix: "[api/messages/conversation] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
