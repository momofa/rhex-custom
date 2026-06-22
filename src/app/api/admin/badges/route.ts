import { randomUUID } from "node:crypto"

import { BadgeRuleOperator, BadgeRuleType, PointEffectDirection, PointEffectRuleKind, PointEffectTargetType, Prisma } from "@/db/types"

import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { isBadgeRuleTypeValue, type BadgeRuleTypeValue } from "@/lib/badge-rule-definitions"
import { prisma } from "@/db/client"
import { findBadgeEffectRulesByBadgeIds } from "@/db/badge-queries"
import { revalidateBadgeDefinitionMutation } from "@/lib/badge-cache-revalidation"
import {
  isFunctionalPointEffectTargetType,
  isPointEffectScopeCompatibleWithTargetType,
  isPointEffectScopeKey,
  isPointEffectTargetTypeEnabledForBadgeEffects,
  normalizePointEffectDirectionByRuleKind,
  normalizePointEffectScopeKeysByTargetType,
} from "@/lib/point-effect-definitions"

function normalizeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim()
}

function normalizeBoolean(value: unknown) {
  return value === true
}

function normalizeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function isRuleType(value: string): value is BadgeRuleTypeValue {
  return isBadgeRuleTypeValue(value)
}

function isRuleOperator(value: string): value is BadgeRuleOperator {
  return Object.values(BadgeRuleOperator).includes(value as BadgeRuleOperator)
}

function isPointEffectTargetType(value: string): value is PointEffectTargetType {
  return Object.values(PointEffectTargetType).includes(value as PointEffectTargetType)
}

function isPointEffectRuleKind(value: string): value is PointEffectRuleKind {
  return Object.values(PointEffectRuleKind).includes(value as PointEffectRuleKind)
}

function isPointEffectDirection(value: string): value is PointEffectDirection {
  return Object.values(PointEffectDirection).includes(value as PointEffectDirection)
}

function ensureArrayInput(input: unknown, label: string) {
  if (input === undefined || input === null) {
    return []
  }

  if (!Array.isArray(input)) {
    apiError(400, `${label}格式不正确`)
  }

  return input
}

function ensureObjectItem(item: unknown, label: string, index: number) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    apiError(400, `${label}第 ${index + 1} 项格式不正确`)
  }

  return item as Record<string, unknown>
}

function parseRules(input: unknown) {
  return ensureArrayInput(input, "领取条件").map((item, index) => {
    const row = ensureObjectItem(item, "领取条件", index)
    const itemLabel = `领取条件第 ${index + 1} 项`
    const ruleType = normalizeText(row.ruleType)
    const operator = normalizeText(row.operator)
    const value = normalizeText(row.value)
    const extraValue = normalizeText(row.extraValue)

    if (!isRuleType(ruleType)) {
      apiError(400, `${itemLabel}的条件类型无效`)
    }

    if (!isRuleOperator(operator)) {
      apiError(400, `${itemLabel}的运算符无效`)
    }

    if (ruleType === BadgeRuleType.VERIFICATION_TYPE && operator !== BadgeRuleOperator.EQ) {
      apiError(400, `${itemLabel}只能使用“拥有”运算符`)
    }

    if (!value) {
      apiError(400, `${itemLabel}的目标值不能为空`)
    }

    if (operator === BadgeRuleOperator.BETWEEN && ruleType !== BadgeRuleType.VERIFICATION_TYPE && !extraValue) {
      apiError(400, `${itemLabel}使用区间运算时必须填写额外值`)
    }

    return {
      ruleType,
      operator,
      value,
      extraValue: extraValue || null,
      sortOrder: normalizeNumber(row.sortOrder, index),
    }
  }) as Array<{
    ruleType: BadgeRuleTypeValue
    operator: BadgeRuleOperator
    value: string
    extraValue: string | null
    sortOrder: number
  }>
}

async function normalizeRulesForStorage(rules: ReturnType<typeof parseRules>) {
  const verificationTypeIds = Array.from(new Set(
    rules
      .filter((rule) => rule.ruleType === BadgeRuleType.VERIFICATION_TYPE)
      .map((rule) => rule.value),
  ))

  if (verificationTypeIds.length === 0) {
    return rules
  }

  const verificationTypes = await prisma.verificationType.findMany({
    where: { id: { in: verificationTypeIds } },
    select: {
      id: true,
      name: true,
    },
  })
  const verificationTypeMap = new Map(verificationTypes.map((item) => [item.id, item.name]))
  const missingVerificationTypeId = verificationTypeIds.find((id) => !verificationTypeMap.has(id))

  if (missingVerificationTypeId) {
    apiError(400, "指定认证不存在")
  }

  return rules.map((rule) => {
    if (rule.ruleType !== BadgeRuleType.VERIFICATION_TYPE) {
      return rule
    }

    return {
      ...rule,
      operator: BadgeRuleOperator.EQ,
      extraValue: verificationTypeMap.get(rule.value) ?? null,
    }
  })
}

function parseOptionalMinute(value: unknown, fieldLabel: string, itemLabel: string) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return null
  }

  const minute = Number(normalized)
  if (!Number.isInteger(minute) || minute < 0 || minute > 1439) {
    apiError(400, `${itemLabel}的${fieldLabel}无效`)
  }

  return minute
}

function parseEffects(input: unknown) {
  return ensureArrayInput(input, "佩戴特效").map((item, index) => {
    const row = ensureObjectItem(item, "佩戴特效", index)
    const itemLabel = `佩戴特效第 ${index + 1} 项`
    const name = normalizeText(row.name)
    const targetType = normalizeText(row.targetType)
    const ruleKind = normalizeText(row.ruleKind)
    const direction = normalizeText(row.direction, PointEffectDirection.BUFF)
    const rawScopeKeys = Array.isArray(row.scopeKeys)
      ? row.scopeKeys.map((scopeKey) => normalizeText(scopeKey))
      : null
    const extraValue = String(row.extraValue ?? "").trim()

    if (!name) {
      apiError(400, `${itemLabel}的特效名称不能为空`)
    }

    if (!isPointEffectTargetType(targetType)) {
      apiError(400, `${itemLabel}的作用目标无效`)
    }

    const normalizedTargetType = targetType as PointEffectTargetType

    if (!isPointEffectTargetTypeEnabledForBadgeEffects(normalizedTargetType)) {
      apiError(400, `${itemLabel}的作用目标当前未开放`)
    }

    const functionalTarget = isFunctionalPointEffectTargetType(normalizedTargetType)

    if (!functionalTarget && !isPointEffectRuleKind(ruleKind)) {
      apiError(400, `${itemLabel}的生效规则无效`)
    }

    if (!isPointEffectDirection(direction)) {
      apiError(400, `${itemLabel}的增减方向无效`)
    }

    if (!rawScopeKeys) {
      apiError(400, `${itemLabel}的生效范围格式不正确`)
    }

    if (rawScopeKeys.length === 0) {
      apiError(400, `${itemLabel}至少选择一个生效范围`)
    }

    const invalidScopeKey = rawScopeKeys.find((scopeKey) => !isPointEffectScopeKey(scopeKey))
    if (invalidScopeKey) {
      apiError(400, `${itemLabel}包含无效的生效范围`)
    }

    const incompatibleScopeKey = rawScopeKeys.find((scopeKey) => !isPointEffectScopeCompatibleWithTargetType(scopeKey, normalizedTargetType))
    if (incompatibleScopeKey) {
      apiError(400, `${itemLabel}的生效范围与作用目标不兼容`)
    }

    const scopeKeys = normalizePointEffectScopeKeysByTargetType(rawScopeKeys, normalizedTargetType)
    if (scopeKeys.length === 0) {
      apiError(400, `${itemLabel}至少选择一个生效范围`)
    }

    const validatedRuleKind = functionalTarget ? PointEffectRuleKind.FIXED : ruleKind as PointEffectRuleKind
    const normalizedRuleKind = functionalTarget
      ? PointEffectRuleKind.FIXED
      : validatedRuleKind
    const normalizedDirection = functionalTarget
      ? PointEffectDirection.BUFF
      : normalizePointEffectDirectionByRuleKind(direction, normalizedRuleKind)
    if (!functionalTarget && normalizedDirection !== direction) {
      apiError(400, `${itemLabel}的增减方向与生效规则不兼容`)
    }

    const parsedValue = functionalTarget ? 1 : Number(row.value)
    if (!functionalTarget && !Number.isFinite(parsedValue)) {
      apiError(400, `${itemLabel}的基础值无效`)
    }

    const parsedExtraValue = functionalTarget ? null : extraValue === "" ? null : Number(extraValue)
    if (!functionalTarget && extraValue !== "" && !Number.isFinite(parsedExtraValue)) {
      apiError(400, `${itemLabel}的额外值无效`)
    }

    return {
      id: normalizeText(row.id) || randomUUID(),
      name,
      description: normalizeText(row.description) || null,
      targetType: normalizedTargetType,
      scopeKeys,
      ruleKind: normalizedRuleKind,
      direction: normalizedDirection,
      value: parsedValue,
      extraValue: parsedExtraValue,
      startMinuteOfDay: functionalTarget ? null : parseOptionalMinute(row.startMinuteOfDay, "开始时间", itemLabel),
      endMinuteOfDay: functionalTarget ? null : parseOptionalMinute(row.endMinuteOfDay, "结束时间", itemLabel),
      sortOrder: normalizeNumber(row.sortOrder, index),
      status: row.status === undefined ? true : normalizeBoolean(row.status),
    }
  }) as Array<{
    id: string
    name: string
    description: string | null
    targetType: PointEffectTargetType
    scopeKeys: string[]
    ruleKind: PointEffectRuleKind
    direction: PointEffectDirection
    value: number
    extraValue: number | null
    startMinuteOfDay: number | null
    endMinuteOfDay: number | null
    sortOrder: number
    status: boolean
  }>
}

async function replaceBadgeEffects(tx: Prisma.TransactionClient, badgeId: string, effects: ReturnType<typeof parseEffects>) {
  await tx.$executeRaw`DELETE FROM "PointEffectRule" WHERE "badgeId" = ${badgeId}`

  if (effects.length === 0) {
    return
  }

  const values = effects.map((effect) => Prisma.sql`(
    ${effect.id},
    ${badgeId},
    ${effect.name},
    ${effect.description},
    ${effect.targetType}::"PointEffectTargetType",
    ${effect.scopeKeys}::TEXT[],
    ${effect.ruleKind}::"PointEffectRuleKind",
    ${effect.direction}::"PointEffectDirection",
    ${effect.value},
    ${effect.extraValue},
    ${effect.startMinuteOfDay},
    ${effect.endMinuteOfDay},
    ${effect.sortOrder},
    ${effect.status},
    NOW(),
    NOW()
  )`)

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "PointEffectRule" (
      "id",
      "badgeId",
      "name",
      "description",
      "targetType",
      "scopeKeys",
      "ruleKind",
      "direction",
      "value",
      "extraValue",
      "startMinuteOfDay",
      "endMinuteOfDay",
      "sortOrder",
      "status",
      "createdAt",
      "updatedAt"
    )
    VALUES ${Prisma.join(values)}
  `)
}

export const GET = createAdminRouteHandler(async () => {
  const badges = await prisma.badge.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      rules: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      _count: {
        select: {
          users: true,
        },
      },
    },
  })
  const effectRows = await findBadgeEffectRulesByBadgeIds(badges.map((badge) => badge.id))
  const effectMap = new Map<string, Awaited<ReturnType<typeof findBadgeEffectRulesByBadgeIds>>[number][]>()

  effectRows.forEach((effect) => {
    if (!effect.badgeId) {
      return
    }

    const current = effectMap.get(effect.badgeId) ?? []
    current.push(effect)
    effectMap.set(effect.badgeId, current)
  })

  return apiSuccess(badges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    code: badge.code,
    description: badge.description,
    iconPath: badge.iconPath,
    iconText: badge.iconText,
    color: badge.color,
    imageUrl: badge.imageUrl,
    category: badge.category,
    sortOrder: badge.sortOrder,
    pointsCost: badge.pointsCost,
    status: badge.status,
    isHidden: badge.isHidden,
    grantedUserCount: badge._count.users,
    createdAt: badge.createdAt.toISOString(),
    updatedAt: badge.updatedAt.toISOString(),
    rules: badge.rules,
    effects: (effectMap.get(badge.id) ?? []).map((effect) => ({
      ...effect,
      createdAt: effect.createdAt.toISOString(),
      updatedAt: effect.updatedAt.toISOString(),
    })),
  })))
}, {
  errorMessage: "读取勋章列表失败",
  logPrefix: "[api/admin/badges:GET] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  permission: "admin.users.grantBadges",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const name = requireStringField(body, "name", "勋章名称和标识不能为空")
  const code = requireStringField(body, "code", "勋章名称和标识不能为空")
  const rules = await normalizeRulesForStorage(parseRules(body.rules))
  const effects = parseEffects(body.effects)

  const badge = await prisma.$transaction(async (tx) => {
    const createdBadge = await tx.badge.create({
      data: {
        name,
        code,
        description: normalizeText(body.description) || undefined,
        iconPath: normalizeText(body.iconPath) || undefined,
        iconText: normalizeText(body.iconText, "🏅") || "🏅",
        color: normalizeText(body.color, "#f59e0b") || "#f59e0b",
        imageUrl: normalizeText(body.imageUrl) || undefined,
        category: normalizeText(body.category, "社区成就") || "社区成就",
        sortOrder: normalizeNumber(body.sortOrder),
        pointsCost: Math.max(0, normalizeNumber(body.pointsCost)),
        status: body.status === undefined ? true : normalizeBoolean(body.status),
        isHidden: normalizeBoolean(body.isHidden),
        rules: {
          create: rules.map((rule) => ({
            ...rule,
            ruleType: rule.ruleType as BadgeRuleType,
          })),
        },
      },
    })

    await replaceBadgeEffects(tx, createdBadge.id, effects)
    return createdBadge
  })

  await writeAdminLog(adminUser.id, "badge.create", "BADGE", badge.id, `创建勋章 ${name}`, requestIp)
  revalidateBadgeDefinitionMutation()
  return apiSuccess({ id: badge.id }, "勋章已创建")
}, {
  errorMessage: "创建勋章失败",
  logPrefix: "[api/admin/badges:POST] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  permission: "admin.users.grantBadges",
})

export const PUT = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const id = requireStringField(body, "id", "缺少必要参数")
  const name = requireStringField(body, "name", "缺少必要参数")
  const code = requireStringField(body, "code", "缺少必要参数")
  const rules = await normalizeRulesForStorage(parseRules(body.rules))
  const effects = parseEffects(body.effects)

  await prisma.$transaction(async (tx) => {
    await tx.badge.update({
      where: { id },
      data: {
        name,
        code,
        description: normalizeText(body.description) || undefined,
        iconPath: normalizeText(body.iconPath) || undefined,
        iconText: normalizeText(body.iconText, "🏅") || "🏅",
        color: normalizeText(body.color, "#f59e0b") || "#f59e0b",
        imageUrl: normalizeText(body.imageUrl) || undefined,
        category: normalizeText(body.category, "社区成就") || "社区成就",
        sortOrder: normalizeNumber(body.sortOrder),
        pointsCost: Math.max(0, normalizeNumber(body.pointsCost)),
        status: body.status === undefined ? true : normalizeBoolean(body.status),
        isHidden: normalizeBoolean(body.isHidden),
      },
    })

    await tx.badgeRule.deleteMany({ where: { badgeId: id } })

    if (rules.length > 0) {
      await tx.badgeRule.createMany({
        data: rules.map((rule) => ({
          badgeId: id,
          ruleType: rule.ruleType as BadgeRuleType,
          operator: rule.operator,
          value: rule.value,
          extraValue: rule.extraValue,
          sortOrder: rule.sortOrder,
        })),
      })
    }

    await replaceBadgeEffects(tx, id, effects)
  })

  await writeAdminLog(adminUser.id, "badge.update", "BADGE", id, `更新勋章 ${name}`, requestIp)
  revalidateBadgeDefinitionMutation()
  return apiSuccess(undefined, "勋章已更新")
}, {
  errorMessage: "更新勋章失败",
  logPrefix: "[api/admin/badges:PUT] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  permission: "admin.users.grantBadges",
})

export const DELETE = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const id = requireStringField(body, "id", "缺少必要参数")

  const grantedCount = await prisma.userBadge.count({ where: { badgeId: id } })
  if (grantedCount > 0) {
    apiError(400, "该勋章已有用户领取记录，暂不允许删除")
  }

  await prisma.badge.delete({ where: { id } })
  await writeAdminLog(adminUser.id, "badge.delete", "BADGE", id, "删除勋章", requestIp)
  revalidateBadgeDefinitionMutation()
  return apiSuccess(undefined, "勋章已删除")
}, {
  errorMessage: "删除勋章失败",
  logPrefix: "[api/admin/badges:DELETE] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  permission: "admin.users.grantBadges",
})
