import { writeAdminLog } from "@/lib/admin"
import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { enqueueRefreshAllUserLevelProgress, getLevelDefinitions, saveLevelDefinitions } from "@/lib/level-system"

export const GET = createAdminRouteHandler(async () => {
  const levels = await getLevelDefinitions()
  return apiSuccess(levels)
}, {
  errorMessage: "读取等级设置失败",
  logPrefix: "[api/admin/levels:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.operations.manage",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action.trim() : ""

  if (action === "refresh-all-users") {
    await enqueueRefreshAllUserLevelProgress()
    await writeAdminLog(adminUser.id, "site.levels.refresh-all-users", "SITE", "level-system", "管理员手动触发了全站用户等级重算")
    return apiSuccess(undefined, "已开始重算全站用户等级，请稍后查看结果")
  }

  const levels = Array.isArray(body.levels) ? body.levels : []

  const saved = await saveLevelDefinitions(levels)
  await writeAdminLog(adminUser.id, "site.levels.update", "SITE", "level-system", `管理员更新了 ${saved.length} 个等级定义`)
  return apiSuccess(saved, "等级系统设置已保存")
}, {
  errorMessage: "保存等级设置失败",
  logPrefix: "[api/admin/levels:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
