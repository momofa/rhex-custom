import { deleteReadSystemNotifications } from "@/db/notification-queries"
import { apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export const POST = createAdminRouteHandler(async () => {
  const result = await deleteReadSystemNotifications()

  revalidateUserSurfaceCache()

  return apiSuccess({ deletedCount: result.count }, `已删除 ${result.count} 条成员已读系统消息`)
}, {
  errorMessage: "删除已读系统消息失败",
  logPrefix: "[api/admin/notifications/read-system/delete] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
