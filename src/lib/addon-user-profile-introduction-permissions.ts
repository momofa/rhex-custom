import "server-only"

import type {
  AddonUserProfileIntroductionPermissionAction,
  AddonUserProfileIntroductionPermissionUser,
  AddonUserProfileIntroductionPermissionValue,
} from "@/addons-host/types"
import { prisma } from "@/db/client"
import type { SessionActor } from "@/db/session-actor-queries"
import { executeAddonAsyncWaterfallHook } from "@/addons-host/runtime/hooks"
import { isVipActive } from "@/lib/vip-status"

export interface UserProfileIntroductionPermissionResult {
  allowed: boolean
  reason: string
}

type UserProfileIntroductionPermissionUserInput = {
  id: number
  username: string
  role: string
  status: string
  level: number
  vipLevel?: number | null
  vipExpiresAt?: string | Date | null
  userBadges?: Array<{ badgeId: string }>
  verificationApplications?: Array<{ typeId: string }>
  displayedBadges?: Array<{ id: string }>
  verification?: { id: string } | null
}

function normalizePermissionValue(
  value: AddonUserProfileIntroductionPermissionValue,
  fallbackReason: string,
): UserProfileIntroductionPermissionResult {
  return {
    allowed: value.allowed !== false,
    reason: typeof value.reason === "string" && value.reason.trim()
      ? value.reason.trim()
      : fallbackReason,
  }
}

function toAddonPermissionUser(
  user: UserProfileIntroductionPermissionUserInput,
): AddonUserProfileIntroductionPermissionUser {
  const verificationTypeIds = new Set<string>()
  const badgeIds = new Set<string>()

  if (Array.isArray(user.verificationApplications)) {
    for (const item of user.verificationApplications) {
      verificationTypeIds.add(item.typeId)
    }
  } else if (user.verification?.id) {
    verificationTypeIds.add(user.verification.id)
  }

  if (Array.isArray(user.userBadges)) {
    for (const item of user.userBadges) {
      badgeIds.add(item.badgeId)
    }
  } else {
    for (const item of user.displayedBadges ?? []) {
      badgeIds.add(item.id)
    }
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    level: user.level,
    vipLevel: user.vipLevel ?? 0,
    vipExpiresAt: user.vipExpiresAt instanceof Date
      ? user.vipExpiresAt.toISOString()
      : user.vipExpiresAt ?? null,
    isVip: isVipActive(user),
    verificationTypeIds: [...verificationTypeIds],
    badgeIds: [...badgeIds],
  }
}

async function findPermissionUserById(userId: number): Promise<UserProfileIntroductionPermissionUserInput | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      level: true,
      vipLevel: true,
      vipExpiresAt: true,
      userBadges: {
        where: {
          badge: {
            status: true,
          },
        },
        select: {
          badgeId: true,
        },
      },
      verificationApplications: {
        where: {
          status: "APPROVED",
        },
        select: {
          typeId: true,
        },
      },
    },
  })
}

function hasCompletePermissionRelations(user: UserProfileIntroductionPermissionUserInput) {
  return Array.isArray(user.userBadges) && Array.isArray(user.verificationApplications)
}

async function hydratePermissionUser(user: UserProfileIntroductionPermissionUserInput) {
  if (hasCompletePermissionRelations(user)) {
    return user
  }

  const found = await findPermissionUserById(user.id)

  return found ? { ...found, ...user, userBadges: found.userBadges, verificationApplications: found.verificationApplications } : user
}

export async function resolveUserProfileIntroductionPermission(input: {
  action: AddonUserProfileIntroductionPermissionAction
  owner: UserProfileIntroductionPermissionUserInput
  viewer?: SessionActor | null
  request?: Request
  fallbackReason?: string
}): Promise<UserProfileIntroductionPermissionResult> {
  const fallbackReason = input.fallbackReason ?? (
    input.action === "edit"
      ? "当前账号暂不可使用个人介绍。"
      : "当前账号暂不可查看个人介绍。"
  )
  const ownerSource = await hydratePermissionUser(input.owner)
  const owner = toAddonPermissionUser(ownerSource)
  const viewerSource = input.viewer
    ? input.viewer.id === input.owner.id
      ? ownerSource
      : await findPermissionUserById(input.viewer.id)
    : null
  const viewer = viewerSource ? toAddonPermissionUser(viewerSource) : null
  const initialValue: AddonUserProfileIntroductionPermissionValue = {
    allowed: true,
    reason: null,
  }
  const hookInput = input.request
    ? {
        request: input.request,
        pathname: new URL(input.request.url).pathname,
        searchParams: new URL(input.request.url).searchParams,
        payload: {
          action: input.action,
          owner,
          viewer,
          isOwner: Boolean(viewer && viewer.id === owner.id),
        },
      }
    : {
        payload: {
          action: input.action,
          owner,
          viewer,
          isOwner: Boolean(viewer && viewer.id === owner.id),
        },
      }

  const hooked = await executeAddonAsyncWaterfallHook(
    "user.profile.introduction.permission",
    initialValue,
    hookInput,
  )

  return normalizePermissionValue(hooked.value, fallbackReason)
}
