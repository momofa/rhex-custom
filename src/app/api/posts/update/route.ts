import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { triggerAiMention } from "@/lib/ai/mention-trigger"
import { revalidateUpdatedPostMutation } from "@/lib/content-mutation-revalidation"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { updatePostFlow } from "@/lib/post-update-service"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = typeof body?.postId === "string" ? body.postId : ""
  const result = await updatePostFlow({
    postId,
    body,
    request,
    currentUser,
  })

  revalidateUpdatedPostMutation({
    postId: result.post.id,
    postSlug: result.post.slug,
    boardSlug: result.post.board.slug,
    zoneSlug: result.post.board.zone?.slug,
    authorId: result.post.authorId,
    affectedTagSlugs: result.affectedTagSlugs,
  })

  logRouteWriteSuccess({
    scope: "posts-update",
    action: result.mode === "append" ? "append-post" : "update-post",
  }, {
    userId: currentUser.id,
    targetId: result.post.id,
    extra: {
      slug: result.post.slug,
      mode: result.mode,
      contentAdjusted: result.contentAdjusted,
    },
  })

  void triggerAiMention({
    kind: "post",
    postId: result.post.id,
    triggerUserId: currentUser.id,
    mentionedUserIds: result.mentionUserIds,
  })

  return apiSuccess({
    id: result.post.id,
    slug: result.post.slug,
  }, result.mode === "append"
    ? `已追加补充内容${result.contentAdjusted ? "，部分内容已自动替换" : ""}`
    : `帖子已更新${result.contentAdjusted ? "，部分内容已自动替换" : ""}`)
}, {
  errorMessage: "修改帖子失败",
  logPrefix: "[api/posts/update] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
