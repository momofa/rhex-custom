import "server-only"

import type { UserRole } from "@/db/types"
import {
  findAdminPermissionGrantsByUserId,
  replaceAdminPermissionGrants,
  type AdminPermissionGrantRecord,
} from "@/db/admin-permission-grant-queries"
import { findFounderAdminId } from "@/db/admin-user-action-queries"
import { apiError } from "@/lib/api-route"
import {
  ADMIN_PERMISSION_CATALOG,
  isAdminPermissionKey,
} from "@/lib/admin-permission-catalog"
import {
  canAdmin,
  getAdminManagementTier,
  getEffectiveAdminPermissionKeys,
  type AdminManagementTier,
  type AdminPermissionGrantInput,
  type AdminPermissionKey,
} from "@/lib/admin-permission-policy"
import type { AdminActor } from "@/lib/moderator-permissions"

export interface AdminPermissionGrantDraft {
  permissionKey: AdminPermissionKey
  allowed: boolean
}

export interface AdminPermissionOverrideState {
  tier: AdminManagementTier
  isFounder: boolean
  grants: AdminPermissionGrantRecord[]
  effectivePermissions: AdminPermissionKey[]
  editablePermissions: AdminPermissionKey[]
}

export async function getAdminPermissionGrants(userId: number) {
  return findAdminPermissionGrantsByUserId(userId)
}

export async function resolveAdminPermissionState(actor: AdminActor): Promise<AdminPermissionOverrideState> {
  const isFounder = actor.role === "ADMIN" ? await isFounderAdminId(actor.id) : false
  const tier = getAdminManagementTier(actor, { isFounder })
  const grants = tier === "SUPER_ADMIN" ? [] : await getAdminPermissionGrants(actor.id)
  const effectivePermissions = getEffectiveAdminPermissionKeys(
    tier,
    ADMIN_PERMISSION_CATALOG.map((item) => item.key),
    grants,
  )

  return {
    tier,
    isFounder,
    grants,
    effectivePermissions,
    editablePermissions: getEditableAdminPermissionKeys({ targetRole: actor.role, targetIsFounder: isFounder }),
  }
}

export async function canAdminWithPermissionOverrides(
  actor: AdminActor | null | undefined,
  permission: AdminPermissionKey,
  context: { isFounder?: boolean } = {},
) {
  if (!actor) {
    return false
  }

  if (context.isFounder || (actor.role === "ADMIN" && await isFounderAdminId(actor.id))) {
    return true
  }

  const grants = await getAdminPermissionGrants(actor.id)
  return canAdmin(actor, permission, { isFounder: false, grants })
}

export function canEditTargetAdminPermissions(params: {
  actor: AdminActor
  actorIsFounder: boolean
  targetId: number
  targetRole: UserRole | string
  targetIsFounder: boolean
}) {
  if (!params.actorIsFounder) {
    return false
  }

  if (params.actor.id === params.targetId) {
    return false
  }

  if (params.targetIsFounder) {
    return false
  }

  return params.targetRole === "ADMIN"
}

export function getEditableAdminPermissionKeys(params: {
  targetRole: UserRole | string
  targetIsFounder: boolean
}) {
  if (params.targetRole !== "ADMIN" || params.targetIsFounder) {
    return []
  }

  return ADMIN_PERMISSION_CATALOG
    .map((item) => item.key)
}

export function normalizeAdminPermissionGrantDrafts(
  grants: unknown,
  editablePermissionKeys: readonly AdminPermissionKey[],
): AdminPermissionGrantDraft[] {
  if (!Array.isArray(grants)) {
    apiError(400, "权限数据格式不正确")
  }

  const editableSet = new Set(editablePermissionKeys)
  const normalized = new Map<AdminPermissionKey, boolean>()

  for (const item of grants) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      apiError(400, "权限数据格式不正确")
    }

    const record = item as Record<string, unknown>
    const permissionKey = record.permissionKey
    if (!isAdminPermissionKey(permissionKey)) {
      apiError(400, "包含不支持的权限项")
    }

    if (!editableSet.has(permissionKey)) {
      apiError(403, "不能修改该权限")
    }

    if (typeof record.allowed !== "boolean") {
      apiError(400, "权限状态格式不正确")
    }

    normalized.set(permissionKey, record.allowed)
  }

  return [...normalized.entries()].map(([permissionKey, allowed]) => ({
    permissionKey,
    allowed,
  }))
}

export function buildPermissionGrantSaveDetail(grants: readonly AdminPermissionGrantInput[]) {
  if (grants.length === 0) {
    return "清空管理员动态权限覆盖"
  }

  const labels = new Map(ADMIN_PERMISSION_CATALOG.map((item) => [item.key, item.label]))
  const allowed = grants
    .filter((grant) => grant.allowed)
    .map((grant) => labels.get(grant.permissionKey) ?? grant.permissionKey)
  const denied = grants
    .filter((grant) => !grant.allowed)
    .map((grant) => labels.get(grant.permissionKey) ?? grant.permissionKey)

  return [
    allowed.length > 0 ? `允许：${allowed.join("、")}` : null,
    denied.length > 0 ? `拒绝：${denied.join("、")}` : null,
  ].filter(Boolean).join("；")
}

export async function saveAdminPermissionGrants(
  userId: number,
  grants: AdminPermissionGrantDraft[],
) {
  await replaceAdminPermissionGrants(userId, grants)
}

async function isFounderAdminId(userId: number) {
  return await findFounderAdminId() === userId
}
