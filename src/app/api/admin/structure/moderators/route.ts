import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { removeStructureModerator, upsertStructureModerator } from "@/lib/admin-structure-moderators"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const result = await upsertStructureModerator({
    actor: adminUser,
    body,
  })

  await writeAdminLog(adminUser.id, result.action, result.targetType, result.targetId, result.detail, getRequestIp(request))
  return apiSuccess(result.data, result.message)
}, {
  errorMessage: "保存版主设置失败",
  logPrefix: "[api/admin/structure/moderators:POST] unexpected error",
  unauthorizedMessage: "无权配置版主",
  allowModerator: true,
})

export const DELETE = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const result = await removeStructureModerator({
    actor: adminUser,
    body,
  })

  await writeAdminLog(adminUser.id, result.action, result.targetType, result.targetId, result.detail, getRequestIp(request))
  return apiSuccess(result.data, result.message)
}, {
  errorMessage: "移除版主失败",
  logPrefix: "[api/admin/structure/moderators:DELETE] unexpected error",
  unauthorizedMessage: "无权配置版主",
  allowModerator: true,
})
