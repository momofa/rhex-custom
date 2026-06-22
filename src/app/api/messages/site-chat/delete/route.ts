import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { deleteSiteChatMessageForAdmin } from "@/lib/messages"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const messageId = requireStringField(body, "messageId", "缺少消息信息")

  return withRequestWriteGuard(createRequestWriteGuardOptions("messages-site-chat-delete", {
    request,
    userId: adminUser.id,
    input: {
      messageId,
    },
  }), async () => {
    const result = await deleteSiteChatMessageForAdmin(messageId, adminUser)

    await writeAdminLog(
      adminUser.id,
      "siteChatMessage.delete",
      "DIRECT_MESSAGE",
      messageId,
      "删除全站聊天室消息",
      getRequestIp(request),
    )

    logRouteWriteSuccess({
      scope: "messages-site-chat-delete",
      action: "delete-site-chat-message",
    }, {
      userId: adminUser.id,
      targetId: messageId,
    })

    return apiSuccess(result, "消息已删除")
  })
}, {
  errorMessage: "删除聊天室消息失败",
  logPrefix: "[api/messages/site-chat/delete] unexpected error",
  unauthorizedMessage: "无权删除全站聊天室消息",
  permission: "admin.operations.manage",
})
