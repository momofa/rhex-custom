import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { runAdminUserBulkAction } from "@/lib/admin-user-bulk-actions"
import { getRequestIp } from "@/lib/request-ip"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const result = await runAdminUserBulkAction(adminUser, {
    action: typeof body.action === "string" ? body.action : "",
    userIds: body.userIds,
    role: body.role,
    message: body.message,
    statusExpiresAt: body.statusExpiresAt,
    statusExpiresAtTimezoneOffsetMinutes: body.statusExpiresAtTimezoneOffsetMinutes,
    requestIp: getRequestIp(request),
  })

  revalidatePath("/admin")

  const message = result.failedCount > 0 || result.skippedCount > 0
    ? `批量操作完成：成功 ${result.affectedCount} 人，跳过 ${result.skippedCount} 人，失败 ${result.failedCount} 人`
    : `批量操作完成：成功 ${result.affectedCount} 人`

  return apiSuccess(result, message)
}, {
  errorMessage: "批量用户操作失败",
  logPrefix: "[api/admin/users/bulk] unexpected error",
  unauthorizedMessage: "无权批量操作用户",
  permission: "admin.users.manage",
})
