import { getCurrentUserRecord } from "@/db/current-user"
import { incrementPostAttachmentDownloadCount } from "@/db/post-attachment-queries"
import { apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { revealExternalPostAttachment } from "@/lib/post-attachments"

export const POST = createRouteHandler(async ({ request, currentUser }: {
  request: Request
  currentUser: Awaited<ReturnType<typeof getCurrentUserRecord>>
}) => {
  const body = await readJsonBody(request)
  const attachmentId = requireStringField(body, "attachmentId", "缺少必要参数")
  const result = await revealExternalPostAttachment({
    attachmentId,
    currentUser,
  })
  const updated = await incrementPostAttachmentDownloadCount(result.attachment.id)

  return apiSuccess({
    attachment: {
      id: result.attachment.id,
      name: result.attachment.name,
      externalUrl: result.attachment.externalUrl,
      externalCode: result.attachment.externalCode,
      downloadCount: updated.downloadCount,
    },
  }, "已获取网盘信息")
}, {
  errorMessage: "获取附件链接失败",
  logPrefix: "[api/post-attachments/reveal] unexpected error",
  buildContext: async (request) => ({
    request,
    currentUser: await getCurrentUserRecord(),
  }),
})
