import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { executePostCreation } from "@/lib/post-create-execution"

export const POST = createUserRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const result = await executePostCreation(body, {
    request,
    log: {
      scope: "posts-create",
      action: "create-post",
    },
  })

  return apiSuccess({
    id: result.post.id,
    slug: result.post.slug,
    status: result.post.status,
  }, result.shouldPending ? "当前节点开启发帖审核，已提交审核" : result.contentAdjusted ? "发布成功，部分内容已自动替换" : "发布成功")
}, {
  errorMessage: "创建帖子失败",
  logPrefix: "[api/posts/create] unexpected error",
  unauthorizedMessage: "请先登录后再发帖",
  allowStatuses: ["ACTIVE"],
  forbiddenMessages: {
    MUTED: "账号已被禁言，暂不可发帖",
    BANNED: "账号已被拉黑，无法发帖",
  },
})
