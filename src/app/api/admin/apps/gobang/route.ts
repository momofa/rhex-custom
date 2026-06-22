import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { revalidateSiteSettingsCache } from "@/lib/admin-site-settings-shared"
import { updateGobangAppConfig } from "@/lib/app-config"

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const config = body.config && typeof body.config === "object" ? body.config as Record<string, unknown> : {}

  const data = await updateGobangAppConfig(config)
  revalidateSiteSettingsCache()
  return apiSuccess(data, "应用配置已保存")
}, {
  errorMessage: "配置保存失败",
  logPrefix: "[api/admin/apps/gobang] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})

