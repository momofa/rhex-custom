import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { revalidateSiteSettingsCache } from "@/lib/admin-site-settings-shared"
import { updateYinYangContractAppConfig } from "@/lib/app-config"

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const config = body.config && typeof body.config === "object" ? body.config as Record<string, unknown> : {}
  const data = await updateYinYangContractAppConfig(config)
  revalidateSiteSettingsCache()
  revalidatePath("/funs/yinyang-contract")
  revalidatePath("/admin/apps/yinyang-contract")
  revalidatePath("/admin/apps")
  return apiSuccess(data, "应用配置已保存")
}, {
  errorMessage: "阴阳契配置保存失败",
  logPrefix: "[api/admin/apps/yinyang-contract] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})
