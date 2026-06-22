import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { revalidatePostDataCache, revalidatePostViewerCache } from "@/lib/post-detail-cache"
import { purchasePostAttachment } from "@/lib/post-attachments"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const attachmentId = requireStringField(body, "attachmentId", "缺少必要参数")
  return withRequestWriteGuard(createRequestWriteGuardOptions("post-attachments-purchase", {
    request,
    userId: currentUser.id,
    input: {
      attachmentId,
    },
  }), async () => {
    const result = await purchasePostAttachment({
      userId: currentUser.id,
      attachmentId,
    })

    if (!result.alreadyOwned && result.attachment) {
      revalidatePostDataCache({ postId: result.attachment.postId })
      revalidatePostViewerCache(currentUser.id)
      revalidateUserSurfaceCache(currentUser.id)
      revalidateUserSurfaceCache(result.attachment.post.authorId)
    }

    return apiSuccess({
      attachmentId,
      alreadyOwned: result.alreadyOwned,
    }, result.alreadyOwned ? "你已购买过该附件" : "购买成功，附件下载权限已解锁")
  })
}, {
  errorMessage: "购买附件失败",
  logPrefix: "[api/post-attachments/purchase] unexpected error",
  unauthorizedMessage: "请先登录后再购买附件",
  allowStatuses: ["ACTIVE", "MUTED"],
})
