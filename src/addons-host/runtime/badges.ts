import "server-only"

import { prisma } from "@/db/client"
import { BadgeGrantSource } from "@/db/types"
import {
  createGrantedUserBadge,
  findGrantedBadgeIdsForUser,
} from "@/db/badge-queries"
import { resolveAddonActor } from "@/addons-host/runtime/actors"
import type {
  AddonBadgeGrantInput,
  AddonBadgeGrantResult,
  AddonBadgeListOptions,
  AddonBadgeSummary,
} from "@/addons-host/types"

const addonBadgeSummarySelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  iconPath: true,
  iconText: true,
  color: true,
  imageUrl: true,
  category: true,
  pointsCost: true,
  status: true,
  isHidden: true,
  _count: {
    select: {
      users: true,
    },
  },
} as const

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function mapAddonBadgeSummary(
  badge: {
    id: string
    code: string
    name: string
    description: string | null
    iconPath: string | null
    iconText: string | null
    color: string
    imageUrl: string | null
    category: string | null
    pointsCost: number
    status: boolean
    isHidden: boolean
    _count: {
      users: number
    }
  },
): AddonBadgeSummary {
  return {
    id: badge.id,
    code: badge.code,
    name: badge.name,
    description: badge.description,
    iconPath: badge.iconPath,
    iconText: badge.iconText,
    color: badge.color,
    imageUrl: badge.imageUrl,
    category: badge.category,
    pointsCost: badge.pointsCost,
    status: badge.status,
    isHidden: badge.isHidden,
    grantedUserCount: badge._count.users,
  }
}

function buildGrantSnapshot(input: {
  badge: AddonBadgeSummary
  grantReason: string
  userId: number
}) {
  return JSON.stringify({
    source: "addon",
    badgeId: input.badge.id,
    badgeCode: input.badge.code,
    badgeName: input.badge.name,
    userId: input.userId,
    grantReason: input.grantReason || null,
    grantedAt: new Date().toISOString(),
  })
}

export async function listAddonBadges(
  options?: AddonBadgeListOptions,
): Promise<AddonBadgeSummary[]> {
  const rows = await prisma.badge.findMany({
    where: {
      ...(options?.includeHidden ? {} : { isHidden: false }),
      ...(options?.includeDisabled ? {} : { status: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: addonBadgeSummarySelect,
  })

  return rows.map(mapAddonBadgeSummary)
}

export async function getAddonGrantedBadgeIds(input: {
  userId?: number
  username?: string
}) {
  const actor = await resolveAddonActor({
    userId: input.userId,
    username: input.username,
    label: "勋章查询账号",
  })

  const granted = await findGrantedBadgeIdsForUser(actor.id)
  return granted.map((item) => item.badgeId)
}

export async function grantAddonBadge(
  input: AddonBadgeGrantInput,
): Promise<AddonBadgeGrantResult> {
  const actor = await resolveAddonActor({
    userId: input.userId,
    username: input.username,
    label: "勋章发放账号",
  })
  const badgeId = normalizeOptionalString(input.badgeId)

  if (!badgeId) {
    throw new Error("勋章 ID 不能为空")
  }

  const badgeRow = await prisma.badge.findUnique({
    where: { id: badgeId },
    select: addonBadgeSummarySelect,
  })

  if (!badgeRow) {
    throw new Error("目标勋章不存在")
  }

  if (!badgeRow.status) {
    throw new Error("目标勋章当前不可发放")
  }

  const badge = mapAddonBadgeSummary(badgeRow)
  const existing = await prisma.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId: actor.id,
        badgeId,
      },
    },
    select: { id: true },
  })

  if (existing && !input.allowDuplicate) {
    return {
      badgeId,
      userId: actor.id,
      granted: false,
      alreadyGranted: true,
      badge,
    }
  }

  if (!existing) {
    await createGrantedUserBadge({
      userId: actor.id,
      badgeId,
      grantSource: BadgeGrantSource.ADMIN_GRANT,
      grantSnapshot: buildGrantSnapshot({
        badge,
        grantReason: normalizeOptionalString(input.grantReason),
        userId: actor.id,
      }),
    })
  }

  return {
    badgeId,
    userId: actor.id,
    granted: !existing,
    alreadyGranted: Boolean(existing),
    badge,
  }
}
