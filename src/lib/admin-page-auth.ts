import { isFounderAdmin } from "@/lib/admin-founder"
import {
  getAdminManagementTier,
  type AdminPermissionKey,
} from "@/lib/admin-permission-policy"
import { canAdminWithPermissionOverrides } from "@/lib/admin-permission-overrides"
import { requireAdminActor } from "@/lib/moderator-permissions"

export async function requireAdminActorWithPermission(
  permission: AdminPermissionKey,
) {
  const state = await getAdminActorPermissionState(permission)
  return state.authorized ? state : null
}

export async function getAdminActorPermissionState(
  permission: AdminPermissionKey,
) {
  const admin = await requireAdminActor()

  if (!admin) {
    return {
      actor: null,
      tier: "USER" as const,
      authorized: false,
      reason: "unauthenticated" as const,
    }
  }

  const actorIsFounder = admin.role === "ADMIN" ? await isFounderAdmin(admin.id) : false
  const tier = getAdminManagementTier(admin, { isFounder: actorIsFounder })
  if (!await canAdminWithPermissionOverrides(admin, permission, { isFounder: actorIsFounder })) {
    return {
      actor: admin,
      tier,
      authorized: false,
      reason: "forbidden" as const,
    }
  }

  return {
    actor: admin,
    tier,
    authorized: true,
    reason: null,
  }
}
