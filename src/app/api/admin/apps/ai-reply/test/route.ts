import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { resolveAiReplyConfigDraftFromAdminInput, isAiReplyConfigTestable } from "@/lib/ai-reply-config"
import { sendAiReplyConnectivityTest } from "@/lib/ai-reply"

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const resolved = await resolveAiReplyConfigDraftFromAdminInput(body)

  if (!resolved.agentUser) {
    apiError(400, "请先填写有效的 AI 代理账号")
  }

  if (!isAiReplyConfigTestable(resolved.config)) {
    apiError(400, "请先完整填写 AI 代理账号、模型接口、模型名称和 API Key")
  }

  const result = await sendAiReplyConnectivityTest({
    config: resolved.config,
    agentUser: resolved.agentUser,
  })

  return apiSuccess(result, "AI 测试成功")
}, {
  errorMessage: "AI 测试失败",
  logPrefix: "[api/admin/apps/ai-reply/test] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})
