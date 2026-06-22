import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { revalidateSiteSettingsCache } from "@/lib/admin-site-settings-shared"
import { revalidateTaskCheckInRewardCache } from "@/lib/task-check-in-display"
import {
  deleteAdminTaskDefinition,
  duplicateAdminTaskDefinition,
  getAdminTaskList,
  saveAdminTaskDefinition,
  updateAdminTaskStatus,
} from "@/lib/admin-task-center"

export const GET = createAdminRouteHandler(async () => {
  return apiSuccess(await getAdminTaskList())
}, {
  errorMessage: "获取任务列表失败",
  logPrefix: "[api/admin/tasks:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.operations.manage",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const action = String(body.action ?? "save")

  if (action === "duplicate") {
    const id = typeof body.id === "string" ? body.id : ""
    const task = await duplicateAdminTaskDefinition(id)
    revalidateSiteSettingsCache()
    revalidateTaskCheckInRewardCache()
    revalidatePath("/tasks")
    revalidatePath("/admin")
    revalidatePath("/admin/settings/vip/tasks")
    return apiSuccess(task, "任务副本已创建")
  }

  if (action === "update-status") {
    const id = typeof body.id === "string" ? body.id : ""
    const status = typeof body.status === "string" ? body.status : ""
    const task = await updateAdminTaskStatus(id, status)
    revalidateSiteSettingsCache()
    revalidateTaskCheckInRewardCache()
    revalidatePath("/tasks")
    revalidatePath("/admin")
    revalidatePath("/admin/settings/vip/tasks")
    return apiSuccess(task, "任务状态已更新")
  }

  if (action === "delete") {
    const id = typeof body.id === "string" ? body.id : ""
    const result = await deleteAdminTaskDefinition(id)
    revalidateSiteSettingsCache()
    revalidateTaskCheckInRewardCache()
    revalidatePath("/tasks")
    revalidatePath("/admin")
    revalidatePath("/admin/settings/vip/tasks")
    return apiSuccess(result, "任务已删除")
  }

  const task = await saveAdminTaskDefinition(body)
  revalidateSiteSettingsCache()
  revalidateTaskCheckInRewardCache()
  revalidatePath("/tasks")
  revalidatePath("/admin")
  revalidatePath("/admin/settings/vip/tasks")
  return apiSuccess(task, typeof body.id === "string" ? "任务已更新" : "任务已创建")
}, {
  errorMessage: "任务操作失败",
  logPrefix: "[api/admin/tasks:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
