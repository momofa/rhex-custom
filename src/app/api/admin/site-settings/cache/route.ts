import { apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { expireSiteSettingsCacheImmediately } from "@/lib/admin-site-settings-shared"

export const POST = createAdminRouteHandler(async () => {
  expireSiteSettingsCacheImmediately()

  return apiSuccess({
    tag: "site-settings",
  }, "站点设置缓存已清除，下一次请求将直接回源")
}, {
  errorMessage: "清除站点设置缓存失败",
  logPrefix: "[api/admin/site-settings/cache:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.siteSettings.manage",
})
