import { UserRole, UserStatus } from "@/db/types"
import {
  deleteModeratorTargetScope,
  findModeratorTargetContext,
  findModeratorUserByUsername,
  upsertModeratorTargetScope,
} from "@/db/admin-moderator-scope-queries"
import { apiError, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { canAdminWithPermissionOverrides } from "@/lib/admin-permission-overrides"
import type { AdminActor } from "@/lib/moderator-permissions"
import { canManageBoard, canManageZone, isSiteAdmin } from "@/lib/moderator-permissions"
import { getUserDisplayName } from "@/lib/user-display"

function readTargetType(value: unknown) {
  return value === "zone" || value === "board" ? value : null
}

function readBoolean(value: unknown) {
  return value === true || value === "true"
}

function ensureCanManageModeratorTarget(actor: AdminActor, target: {
  targetType: "zone" | "board"
  targetId: string
  zoneId?: string | null
}) {
  if (isSiteAdmin(actor)) {
    return
  }

  if (target.targetType === "zone") {
    if (!canManageZone(actor, target.targetId)) {
      apiError(403, "无权配置该分区版主")
    }
    return
  }

  if (!canManageBoard(actor, target.targetId, target.zoneId)) {
    apiError(403, "无权配置该节点版主")
  }
}

async function ensureCanAssignModerators(actor: AdminActor) {
  if (!await canAdminWithPermissionOverrides(actor, "admin.structure.assignModerators")) {
    apiError(403, "无权配置版主")
  }
}

export async function upsertStructureModerator(params: {
  actor: AdminActor
  body: JsonObject
}) {
  await ensureCanAssignModerators(params.actor)

  const rawBody = params.body as Record<string, unknown>
  const targetType = readTargetType(rawBody.targetType)
  const targetId = readOptionalStringField(rawBody, "targetId")
  const username = readOptionalStringField(rawBody, "username")

  if (!targetType || !targetId || !username) {
    apiError(400, "缺少版主、分区或节点参数")
  }

  const [target, moderator] = await Promise.all([
    findModeratorTargetContext({ targetType, targetId }),
    findModeratorUserByUsername(username),
  ])

  if (!target) {
    apiError(404, targetType === "zone" ? "分区不存在" : "节点不存在")
  }

  ensureCanManageModeratorTarget(params.actor, {
    targetType,
    targetId,
    zoneId: target.zoneId,
  })

  if (!moderator) {
    apiError(404, "版主用户不存在")
  }

  if (moderator.status !== UserStatus.ACTIVE) {
    apiError(400, "只能添加启用状态的用户为版主")
  }

  const promoteToModerator = moderator.role === UserRole.USER
  const effectiveRole = promoteToModerator ? UserRole.MODERATOR : moderator.role

  await upsertModeratorTargetScope({
    moderatorId: moderator.id,
    targetType,
    targetId,
    canEditSettings: readBoolean(rawBody.canEditSettings),
    canWithdrawTreasury: rawBody.canWithdrawTreasury !== false && rawBody.canWithdrawTreasury !== "false",
    promoteToModerator,
  })

  return {
    message: promoteToModerator
      ? `已将 @${moderator.username} 设为版主，并更新${targetType === "zone" ? "分区" : "节点"}授权`
      : `已更新 @${moderator.username} 的${targetType === "zone" ? "分区" : "节点"}版主设置`,
    data: {
      moderator: {
        id: moderator.id,
        username: moderator.username,
        displayName: getUserDisplayName(moderator),
        role: effectiveRole,
        status: moderator.status,
        canEditSettings: readBoolean(rawBody.canEditSettings),
        canWithdrawTreasury: rawBody.canWithdrawTreasury !== false && rawBody.canWithdrawTreasury !== "false",
        source: targetType,
      },
    },
    action: "moderator.scope.upsert",
    targetType: targetType === "zone" ? "ZONE" : "BOARD",
    targetId,
    detail: promoteToModerator
      ? `将 @${moderator.username} 设为版主并更新 ${target.name} 授权`
      : `更新 ${target.name} 的版主 @${moderator.username}`,
  }
}

export async function removeStructureModerator(params: {
  actor: AdminActor
  body: JsonObject
}) {
  await ensureCanAssignModerators(params.actor)

  const rawBody = params.body as Record<string, unknown>
  const targetType = readTargetType(rawBody.targetType)
  const targetId = readOptionalStringField(rawBody, "targetId")
  const moderatorId = Number(rawBody.moderatorId)

  if (!targetType || !targetId || !Number.isInteger(moderatorId) || moderatorId <= 0) {
    apiError(400, "缺少版主、分区或节点参数")
  }

  const target = await findModeratorTargetContext({ targetType, targetId })
  if (!target) {
    apiError(404, targetType === "zone" ? "分区不存在" : "节点不存在")
  }

  ensureCanManageModeratorTarget(params.actor, {
    targetType,
    targetId,
    zoneId: target.zoneId,
  })

  await deleteModeratorTargetScope({
    moderatorId,
    targetType,
    targetId,
  })

  return {
    message: "版主已移除",
    data: { moderatorId },
    action: "moderator.scope.delete",
    targetType: targetType === "zone" ? "ZONE" : "BOARD",
    targetId,
    detail: `移除 ${target.name} 的版主 #${moderatorId}`,
  }
}
