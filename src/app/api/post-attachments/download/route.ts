import { getCurrentUserRecord } from "@/db/current-user"
import { incrementPostAttachmentDownloadCount } from "@/db/post-attachment-queries"
import { apiError, createRouteHandler, requireSearchParam } from "@/lib/api-route"
import { requireAccessiblePostAttachment } from "@/lib/post-attachments"
import { createDownloadResponseFromStoredUpload } from "@/lib/upload"

export const GET = createRouteHandler(async ({ request, currentUser }: {
  request: Request
  currentUser: Awaited<ReturnType<typeof getCurrentUserRecord>>
}) => {
  const attachmentId = requireSearchParam(request, "attachmentId", "缺少附件参数")
  const result = await requireAccessiblePostAttachment({
    attachmentId,
    currentUser,
  })

  if (result.attachment.sourceType !== "UPLOAD" || !result.attachment.upload?.storagePath) {
    apiError(400, "当前附件不是站内上传类型")
  }

  const response = await createDownloadResponseFromStoredUpload({
    storagePath: result.attachment.upload.storagePath,
    mimeType: result.attachment.mimeType ?? result.attachment.upload.mimeType,
    fileSize: result.attachment.fileSize ?? result.attachment.upload.fileSize,
    fileName: result.attachment.name,
  })

  await incrementPostAttachmentDownloadCount(result.attachment.id)

  return response
}, {
  errorMessage: "下载附件失败",
  logPrefix: "[api/post-attachments/download] unexpected error",
  buildContext: async (request) => ({
    request,
    currentUser: await getCurrentUserRecord(),
  }),
})
