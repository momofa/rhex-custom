import "server-only"

import { prisma } from "@/db/client"
import { isPointEffectScopeKey, type PointEffectScopeKey } from "@/lib/point-effect-definitions"
import { applyPointDelta, prepareScopedPointDelta, type PreparedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { resolveAddonActor } from "@/addons-host/runtime/actors"
import type {
  AddonPointAdjustInput,
  AddonPointAdjustResult,
} from "@/addons-host/types"

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function buildPreparedDelta(delta: number, scopeKey: string | null, userId: number) {
  if (scopeKey) {
    if (!isPointEffectScopeKey(scopeKey)) {
      throw new Error(`未知的积分作用域：${scopeKey}`)
    }

    return prepareScopedPointDelta({
      scopeKey,
      baseDelta: delta,
      userId,
    }).then((prepared) => ({
      prepared,
      scopeKey,
      effectsApplied: true,
    }))
  }

  return Promise.resolve({
    prepared: {
      scopeKey: "ALL_POINT_CHANGES" as PointEffectScopeKey,
      baseDelta: delta,
      finalDelta: delta,
      appliedRules: [],
    } satisfies PreparedPointDelta,
    scopeKey: null,
    effectsApplied: false,
  })
}

export async function adjustAddonPoints(
  input: AddonPointAdjustInput,
): Promise<AddonPointAdjustResult> {
  const targetUser = await resolveAddonActor({
    userId: input.targetUserId,
    username: input.targetUsername,
    label: "积分目标账号",
  })
  const delta = typeof input.delta === "number" && Number.isFinite(input.delta)
    ? Math.trunc(input.delta)
    : Number.parseInt(String(input.delta ?? ""), 10)

  if (!Number.isFinite(delta)) {
    throw new Error("积分变动值必须是整数")
  }

  const reason = normalizeOptionalString(input.reason)
  if (!reason) {
    throw new Error("积分变动原因不能为空")
  }

  const settings = await getSiteSettings()
  const prepared = await buildPreparedDelta(
    delta,
    normalizeOptionalString(input.scopeKey) || null,
    targetUser.id,
  )

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: targetUser.id },
      select: {
        id: true,
        points: true,
      },
    })

    if (!user) {
      throw new Error("积分目标账号不存在")
    }

    const applied = await applyPointDelta({
      tx,
      userId: targetUser.id,
      beforeBalance: user.points,
      prepared: prepared.prepared,
      pointName: settings.pointName,
      reason,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      insufficientMessage: normalizeOptionalString(input.insufficientMessage) || undefined,
    })

    return applied
  })

  revalidateUserSurfaceCache(targetUser.id)

  return {
    userId: targetUser.id,
    pointName: settings.pointName,
    finalDelta: result.finalDelta,
    afterBalance: result.afterBalance,
    scopeKey: prepared.scopeKey,
    effectsApplied: prepared.effectsApplied,
  }
}
