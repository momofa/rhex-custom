import type { JsonObject } from "@/lib/api-route"

import { createSiteSettingsRecordWithFullData, findSiteSettingsRecordForUpdate } from "@/db/site-settings-write-queries"
import {
  canAccessAdminSettingsSection,
  canAdminTierWithEffectivePermissions,
  type AdminSettingsSectionKey,
} from "@/lib/admin-navigation"
import { canAdminActorUsePermission } from "@/lib/admin-scope-permissions"
import { updateBoardApplicationSiteSettingsSection } from "@/lib/admin-site-settings-board-applications"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { updateInteractionSiteSettingsSection } from "@/lib/admin-site-settings-interaction"
import { updateMessageSiteSettingsSection } from "@/lib/admin-site-settings-messages"
import { updateOAuthSiteSettingsSection } from "@/lib/admin-site-settings-oauth"
import { updateProfileSiteSettingsSection } from "@/lib/admin-site-settings-profile"
import { updateRegistrationSiteSettingsSection } from "@/lib/admin-site-settings-registration"
import { updateUploadSiteSettingsSection } from "@/lib/admin-site-settings-upload"
import { updateVipSiteSettingsSection } from "@/lib/admin-site-settings-vip"
import { apiError, readOptionalStringField } from "@/lib/api-route"
import type { AdminManagementTier, AdminPermissionKey } from "@/lib/admin-permission-policy"
import { resolveAdminPermissionState } from "@/lib/admin-permission-overrides"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"

const SITE_SETTINGS_ACCESS_PERMISSIONS = [
  "admin.siteSettings.manage",
  "admin.operations.manage",
] satisfies AdminPermissionKey[]

async function getOrCreateSiteSettingsUnchecked() {
  const existing = await findSiteSettingsRecordForUpdate()
  if (existing) {
    return existing
  }

  return createSiteSettingsRecordWithFullData(defaultSiteSettingsCreateInput)
}

async function ensureCanAccessSiteSettings(message: string) {
  const actor = await requireSiteAdminActor()
  if (!actor) {
    apiError(403, message)
  }

  for (const permission of SITE_SETTINGS_ACCESS_PERMISSIONS) {
    if (await canAdminActorUsePermission(actor, permission)) {
      return actor
    }
  }

  apiError(403, message)
}

async function resolveSiteSettingsMutationPermissionContext(options?: {
  adminTier?: AdminManagementTier
  effectivePermissions?: ReadonlySet<AdminPermissionKey>
}): Promise<{
  adminTier: AdminManagementTier
  effectivePermissions?: ReadonlySet<AdminPermissionKey>
}> {
  if (options?.adminTier) {
    return {
      adminTier: options.adminTier,
      effectivePermissions: options.effectivePermissions,
    }
  }

  const actor = await ensureCanAccessSiteSettings("无权修改该设置分组")
  const permissionState = await resolveAdminPermissionState(actor)
  const effectivePermissionSet = new Set(permissionState.effectivePermissions)
  const canAccessSettings = SITE_SETTINGS_ACCESS_PERMISSIONS.some((permission) =>
    canAdminTierWithEffectivePermissions(permissionState.tier, permission, effectivePermissionSet)
  )

  if (!canAccessSettings) {
    apiError(403, "无权修改该设置分组")
  }

  return {
    adminTier: permissionState.tier,
    effectivePermissions: effectivePermissionSet,
  }
}

export async function getOrCreateSiteSettings() {
  await ensureCanAccessSiteSettings("无权访问站点设置")
  return getOrCreateSiteSettingsUnchecked()
}

const siteSettingsSectionMap: Record<string, AdminSettingsSectionKey> = {
  "site-profile": "profile",
  "site-apps": "apps",
  "site-markdown-emoji": "markdown-emoji",
  "site-footer-links": "footer-links",
  "site-editor-toolbar": "editor-toolbar",
  "site-registration": "registration",
  "site-board-applications": "board-applications",
  "board-applications": "board-applications",
  interaction: "interaction",
  "site-interaction": "interaction",
  messages: "messages",
  "site-messages": "messages",
  "site-friend-links": "friend-links",
  vip: "vip",
  upload: "upload",
  "site-oauth": "oauth",
}

function resolveAdminSettingsSectionForMutation(section: string) {
  return siteSettingsSectionMap[section] ?? null
}

export async function updateSiteSettingsBySection(
  body: JsonObject,
  options?: {
    adminTier?: AdminManagementTier
    effectivePermissions?: ReadonlySet<AdminPermissionKey>
  },
) {
  const section = readOptionalStringField(body, "section") || "site-profile"
  const permissionContext = await resolveSiteSettingsMutationPermissionContext(options)
  const adminSettingsSection = resolveAdminSettingsSectionForMutation(section)
  if (!adminSettingsSection || !canAccessAdminSettingsSection(permissionContext.adminTier, adminSettingsSection, permissionContext.effectivePermissions)) {
    apiError(403, "无权修改该设置分组")
  }

  const existing = await getOrCreateSiteSettingsUnchecked()

  const handlers = [
    updateProfileSiteSettingsSection,
    updateRegistrationSiteSettingsSection,
    updateBoardApplicationSiteSettingsSection,
    updateInteractionSiteSettingsSection,
    updateMessageSiteSettingsSection,
    updateVipSiteSettingsSection,
    updateUploadSiteSettingsSection,
    updateOAuthSiteSettingsSection,
  ]

  for (const handler of handlers) {
    const result = await handler(existing, body, section)
    if (result) {
      return result
    }
  }

  apiError(400, "不支持的设置分组")
}
