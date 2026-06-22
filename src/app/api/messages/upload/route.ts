import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { createUploadRecord, findExistingUpload } from "@/db/upload-queries"
import { buildMessageFileProxyUrl, buildMessageFileToken, buildMessageImageMarkdown, MESSAGE_FILE_UPLOAD_FOLDER, MESSAGE_IMAGE_UPLOAD_FOLDER } from "@/lib/message-media"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { isAllowedUploadMimeType, normalizeUploadExtension } from "@/lib/upload-rules"
import { prepareBinaryUploadedFile, prepareUploadedFile, saveUploadedFile } from "@/lib/upload"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

type MessageUploadResponse = {
  kind: "image" | "file"
  token: string
  originalName: string
  urlPath: string
  fileExt: string
  mimeType: string
}

export const POST = createUserRouteHandler<MessageUploadResponse>(async ({ request, currentUser }) => {
  const settings = await getSiteSettings()
  const formData = await request.formData()
  const file = formData.get("file")

  if (!settings.messageEnabled) {
    apiError(403, "当前站点未开启私信功能")
  }

  if (!(file instanceof File)) {
    apiError(400, "缺少上传文件")
  }

  if (file.size <= 0) {
    apiError(400, "上传文件不能为空")
  }

  const extension = normalizeUploadExtension(file.name)
  const allowedImageExtensions = settings.uploadAllowedImageTypes.map((item) => item.trim().toLowerCase()).filter(Boolean)
  const allowedFileExtensions = settings.attachmentAllowedExtensions.map((item) => item.trim().toLowerCase()).filter(Boolean)
  const isImageUpload = file.type.startsWith("image/") || (!!extension && allowedImageExtensions.includes(extension))

  if (isImageUpload) {
    if (!settings.messageImageUploadEnabled) {
      apiError(403, "当前站点未开启私信图片发送")
    }

    if (!extension || !allowedImageExtensions.includes(extension)) {
      apiError(400, `仅支持上传 ${allowedImageExtensions.join(" / ")} 格式的图片`)
    }

    const maxSizeBytes = Math.max(1, settings.uploadMaxFileSizeMb) * 1024 * 1024
    if (file.size > maxSizeBytes) {
      apiError(400, `图片大小不能超过 ${settings.uploadMaxFileSizeMb}MB`)
    }

    const preparedFile = await prepareUploadedFile(file, {
      folder: MESSAGE_IMAGE_UPLOAD_FOLDER,
      settings,
    })

    if (!isAllowedUploadMimeType(preparedFile.detectedMime, allowedImageExtensions)) {
      apiError(400, `仅支持上传 ${allowedImageExtensions.join(" / ")} 格式的图片`)
    }

    return withRequestWriteGuard(createRequestWriteGuardOptions("messages-upload", {
      request,
      userId: currentUser.id,
      input: {
        kind: "image",
        fileHash: preparedFile.fileHash,
      },
    }), async () => {
      const existing = await findExistingUpload(currentUser.id, MESSAGE_IMAGE_UPLOAD_FOLDER, preparedFile.fileHash)
      const saved = existing ?? await createUploadRecord({
        userId: currentUser.id,
        bucketType: MESSAGE_IMAGE_UPLOAD_FOLDER,
        originalName: file.name,
        saved: await saveUploadedFile(file, preparedFile, MESSAGE_IMAGE_UPLOAD_FOLDER, {
          request,
          actor: {
            id: currentUser.id,
            username: currentUser.username,
            kind: "user",
          },
        }),
      })

      logRouteWriteSuccess({
        scope: "messages-upload",
        action: "upload-message-image",
      }, {
        userId: currentUser.id,
        targetId: saved.id,
        extra: {
          originalName: saved.originalName,
          urlPath: saved.urlPath,
        },
      })

      return apiSuccess({
        kind: "image" as const,
        token: buildMessageImageMarkdown(saved.originalName, saved.urlPath),
        originalName: saved.originalName,
        urlPath: saved.urlPath,
        fileExt: saved.fileExt,
        mimeType: saved.mimeType,
      }, "图片上传成功")
    })
  }

  if (!settings.messageFileUploadEnabled) {
    apiError(403, "当前站点未开启私信文件发送")
  }

  if (!extension || !allowedFileExtensions.includes(extension)) {
    apiError(400, `仅支持上传 ${allowedFileExtensions.join(" / ")} 格式的文件`)
  }

  const maxSizeBytes = Math.max(1, settings.attachmentMaxFileSizeMb) * 1024 * 1024
  if (file.size > maxSizeBytes) {
    apiError(400, `文件大小不能超过 ${settings.attachmentMaxFileSizeMb}MB`)
  }

  const preparedFile = await prepareBinaryUploadedFile(file)

  return withRequestWriteGuard(createRequestWriteGuardOptions("messages-upload", {
    request,
    userId: currentUser.id,
    input: {
      kind: "file",
      fileHash: preparedFile.fileHash,
    },
  }), async () => {
    const existing = await findExistingUpload(currentUser.id, MESSAGE_FILE_UPLOAD_FOLDER, preparedFile.fileHash)
    const saved = existing ?? await createUploadRecord({
      userId: currentUser.id,
      bucketType: MESSAGE_FILE_UPLOAD_FOLDER,
      originalName: file.name,
      saved: await saveUploadedFile(file, preparedFile, MESSAGE_FILE_UPLOAD_FOLDER, {
        request,
        actor: {
          id: currentUser.id,
          username: currentUser.username,
          kind: "user",
        },
      }),
    })

    logRouteWriteSuccess({
      scope: "messages-upload",
      action: "upload-message-file",
    }, {
      userId: currentUser.id,
      targetId: saved.id,
      extra: {
        originalName: saved.originalName,
        urlPath: saved.urlPath,
        fileExt: saved.fileExt,
      },
    })

    const proxyUrl = buildMessageFileProxyUrl(saved.id, saved.originalName)

    return apiSuccess({
      kind: "file" as const,
      token: buildMessageFileToken(saved.originalName, proxyUrl),
      originalName: saved.originalName,
      urlPath: proxyUrl,
      fileExt: saved.fileExt,
      mimeType: saved.mimeType,
    }, "文件上传成功")
  })
}, {
  errorMessage: "私信附件上传失败",
  logPrefix: "[api/messages/upload] unexpected error",
  unauthorizedMessage: "请先登录后再上传私信附件",
  allowStatuses: ["ACTIVE", "MUTED"],
  forbiddenMessages: {
    BANNED: "账号已被拉黑，无法上传私信附件",
    INACTIVE: "账号未激活，无法上传私信附件",
  },
})
