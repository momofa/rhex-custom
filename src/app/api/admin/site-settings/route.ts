import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getOrCreateSiteSettings, updateSiteSettingsBySection } from "@/lib/admin-site-settings-service"
import { revalidateAdminMutationPaths } from "@/lib/admin-action-types"
import { resolveAdminPermissionState } from "@/lib/admin-permission-overrides"
import { canAdminTierWithEffectivePermissions } from "@/lib/admin-navigation"
import type { AdminPermissionKey } from "@/lib/admin-permission-policy"
import type { AdminActor } from "@/lib/moderator-permissions"

const SITE_SETTINGS_ACCESS_PERMISSIONS = [
  "admin.siteSettings.manage",
  "admin.operations.manage",
] satisfies AdminPermissionKey[]

async function resolveSiteSettingsPermissionContext(adminUser: AdminActor, message: string) {
  const permissionState = await resolveAdminPermissionState(adminUser)
  const effectivePermissionSet = new Set(permissionState.effectivePermissions)
  const canAccessSettings = SITE_SETTINGS_ACCESS_PERMISSIONS.some((permission) =>
    canAdminTierWithEffectivePermissions(permissionState.tier, permission, effectivePermissionSet)
  )

  if (!canAccessSettings) {
    apiError(403, message)
  }

  return {
    permissionState,
    effectivePermissionSet,
  }
}

export const GET = createAdminRouteHandler(async ({ adminUser }) => {
  await resolveSiteSettingsPermissionContext(adminUser, "无权访问站点设置")
  const settings = await getOrCreateSiteSettings()
  return apiSuccess(settings)
}, {
  errorMessage: "读取站点设置失败",
  logPrefix: "[api/admin/site-settings:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const { permissionState, effectivePermissionSet } = await resolveSiteSettingsPermissionContext(adminUser, "无权操作")
  const result = await updateSiteSettingsBySection(body, {
    adminTier: permissionState.tier,
    effectivePermissions: effectivePermissionSet,
  })

  if (result.revalidatePaths?.length) {
    revalidateAdminMutationPaths(result.revalidatePaths)
  }

  return apiSuccess(result.settings, result.message)
}, {
  errorMessage: "保存站点设置失败",
  logPrefix: "[api/admin/site-settings:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
