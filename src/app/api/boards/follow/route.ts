import { toggleFollowTarget } from "@/db/follow-queries"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { recordFollowBoardTaskEvent } from "@/lib/task-center-service"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const boardId = requireStringField(body, "boardId", "缺少节点参数")

  return withRequestWriteGuard(createRequestWriteGuardOptions("boards-follow-toggle", {
    request,
    userId: currentUser.id,
    input: {
      boardId,
    },
  }), async () => {
    const result = await toggleFollowTarget({
      userId: currentUser.id,
      targetType: "board",
      targetId: boardId,
    })

    if (result.status === "missing") {
      apiError(404, "节点不存在")
    }

    if (result.status !== "ok") {
      apiError(400, "关注节点失败")
    }

    if (result.followed && result.changed) {
      void recordFollowBoardTaskEvent({
        type: "FOLLOW_BOARD",
        userId: currentUser.id,
        boardId,
      }).catch((error) => {
        console.error("[api/boards/follow] record follow-board task event failed", error)
      })
    }

    revalidateUserSurfaceCache(currentUser.id)

    return apiSuccess({ followed: result.followed }, result.followed ? "关注节点成功" : "已取消关注节点")
  })
}, {
  errorMessage: "关注节点失败",
  logPrefix: "[api/boards/follow] unexpected error",
  unauthorizedMessage: "请先登录后再关注节点",
  allowStatuses: ["ACTIVE", "MUTED"],
})
