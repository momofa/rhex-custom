import { apiError, apiSuccess, createRouteHandler, requireSearchParam } from "@/lib/api-route"
import { getLotteryParticipantList } from "@/lib/lottery"

export const GET = createRouteHandler(async ({ request }) => {
  const postId = requireSearchParam(request, "postId", "缺少帖子参数")
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1)
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10)

  const result = await getLotteryParticipantList(postId, { page, pageSize })
  if (!result) {
    apiError(404, "当前帖子没有可公开的抽奖参与记录")
  }

  return apiSuccess(result)
}, {
  errorMessage: "加载抽奖参与记录失败",
  logPrefix: "[api/posts/lottery/participants] unexpected error",
})
