import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { canAdminActorManageBoardWithPermission } from "@/lib/admin-scope-permissions"
import { drawLotteryWinners } from "@/lib/lottery"
import { resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"
import { revalidatePostDataCache } from "@/lib/post-detail-cache"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子参数")

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      type: true,
      boardId: true,
      board: {
        select: {
          zoneId: true,
        },
      },
    },
  })

  if (!post || post.type !== "LOTTERY") {
    apiError(404, "抽奖帖不存在")
  }

  const adminActor = await resolveAdminActorFromSessionUser(currentUser)
  const canManageAsAdmin = Boolean(
    adminActor
    && await canAdminActorManageBoardWithPermission(
      adminActor,
      "admin.content.manage",
      post.boardId,
      post.board.zoneId,
    ),
  )
  if (!canManageAsAdmin && post.authorId !== currentUser.id) {
    apiError(403, "仅楼主或管理员可开奖")
  }

  const result = await drawLotteryWinners(postId, { actorId: currentUser.id })
  revalidatePostDataCache({ postId })
  return apiSuccess(result, "开奖成功")
}, {
  errorMessage: "开奖失败",
  logPrefix: "[api/posts/draw] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

