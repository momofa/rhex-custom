import { formatNumber } from "@/lib/formatters"
import { isImageSource, isSvgMarkup } from "@/lib/icon-source"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

export interface HookableUserBadge {
  id?: string | null
  code?: string | null
  name: string
  description?: string | null
  color?: string | null
  iconText?: string | null
  displayOrder?: number | null
}

export interface PublicUserLevelBadge {
  level: number
  name: string
  color: string
  icon: string
}

export interface PublicUserVerificationBadge {
  id: string
  slug?: string | null
  name: string
  color: string
  iconText?: string | null
  customIconText?: string | null
  description?: string | null
  customDescription?: string | null
}

export interface PublicUserDisplayedBadge {
  id: string
  code?: string | null
  name: string
  description?: string | null
  color: string
  iconText?: string | null
  displayOrder?: number | null
}

export type PublicUserIdentityTagTone =
  | "plain"
  | "vip"
  | "level"
  | "orange"
  | "sky"
  | "danger"
  | "warning"

export interface PublicUserIdentityTag {
  key: string
  label: string
  tone?: PublicUserIdentityTagTone
  tooltip?: string | null
  order?: number | null
}

export interface PublicUserRoleBadge {
  key: string
  label: string
  shortLabel?: string | null
  tone?: PublicUserIdentityTagTone
  tooltip?: string | null
}

export const PUBLIC_USER_ICON_TEXT_MAX_LENGTH = 24
export const PUBLIC_USER_ICON_SOURCE_MAX_LENGTH = 20000

export function normalizePublicUserIconText(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (isSvgMarkup(normalized)) {
    return normalized.length <= PUBLIC_USER_ICON_SOURCE_MAX_LENGTH ? normalized : null
  }

  if (isImageSource(normalized)) {
    return normalized.length <= PUBLIC_USER_ICON_SOURCE_MAX_LENGTH ? normalized : null
  }

  if (normalized.startsWith("<") || normalized.includes("<svg")) {
    return null
  }

  return normalized.slice(0, PUBLIC_USER_ICON_TEXT_MAX_LENGTH)
}

export function buildDefaultPublicUserIdentityTags(input: {
  role?: string | null
  status?: string | null
  vipLevel?: number | null
  vipExpiresAt?: string | Date | null
  levelName?: string | null
  inviteCount?: number | null
  likeReceivedCount?: number | null
  postCount?: number | null
}): PublicUserIdentityTag[] {
  const tags: PublicUserIdentityTag[] = []
  const pushTag = (tag: PublicUserIdentityTag) => {
    if (!tags.some((item) => item.key === tag.key)) {
      tags.push(tag)
    }
  }

  if (input.role === "ADMIN") {
    pushTag({ key: "role-admin", label: "管理员", tone: "danger", order: 10 })
  } else if (input.role === "MODERATOR") {
    pushTag({ key: "role-moderator", label: "版主", tone: "sky", order: 10 })
  }

  if (input.status === "BANNED") {
    pushTag({ key: "status-banned", label: "账号封禁中", tone: "danger", order: 20 })
  } else if (input.status === "MUTED") {
    pushTag({ key: "status-muted", label: "账号禁言中", tone: "warning", order: 20 })
  }

  if (isVipActive(input)) {
    pushTag({ key: "vip", label: `VIP${getVipLevel(input)}`, tone: "vip", order: 30 })
  }

  const levelName = input.levelName?.trim()
  if (levelName) {
    pushTag({ key: "level", label: levelName, tone: "level", order: 40 })
  }

  if ((input.inviteCount ?? 0) > 0) {
    pushTag({ key: "inviter", label: "邀请达人", tone: "orange", order: 50 })
  }

  if ((input.likeReceivedCount ?? 0) >= 50) {
    pushTag({ key: "liked", label: "高赞用户", tone: "level", order: 60 })
  }

  if ((input.postCount ?? 0) >= 10) {
    pushTag({ key: "creator", label: "活跃创作者", tone: "sky", order: 70 })
  }

  return tags
}

export function getDefaultPublicUserRoleBadge(role?: string | null): PublicUserRoleBadge | null {
  if (role === "ADMIN") {
    return {
      key: "admin",
      label: "管理员",
      shortLabel: "Admin",
      tone: "danger",
      tooltip: "管理员",
    }
  }

  if (role === "MODERATOR") {
    return {
      key: "moderator",
      label: "版主",
      shortLabel: "Mod",
      tone: "sky",
      tooltip: "版主",
    }
  }

  return null
}

export function getPublicUserRoleBadgeLabel(input: {
  role?: string | null
  roleBadge?: PublicUserRoleBadge | null
}) {
  if (input.roleBadge === null) {
    return null
  }

  if (input.roleBadge === undefined) {
    if (input.role === "ADMIN") {
      return "管理员"
    }
    if (input.role === "MODERATOR") {
      return "版主"
    }
    return null
  }

  return input.roleBadge.shortLabel?.trim() || input.roleBadge.label
}

export function getPublicUidLabel(input: {
  id?: number | null
  userId?: number | null
  publicUid?: string | null
}) {
  const publicUid = input.publicUid?.trim()
  if (publicUid) {
    return publicUid
  }

  const fallbackId = typeof input.id === "number" ? input.id : input.userId
  return typeof fallbackId === "number" ? formatNumber(fallbackId) : ""
}

export interface HookableUserPresentationKeyInput {
  userId?: number | null
  username?: string | null
  displayName: string
  avatarPath?: string | null
  role?: string | null
  status?: string | null
  level?: number | null
  vipLevel?: number | null
  badges?: readonly HookableUserBadge[] | null
  levelBadge?: PublicUserLevelBadge | null
  verificationBadge?: PublicUserVerificationBadge | null
  roleBadge?: PublicUserRoleBadge | null
  identityTags?: readonly PublicUserIdentityTag[] | null
}

export function collectHookableBadgeCodes(
  badges?: readonly HookableUserBadge[] | null,
) {
  return [...new Set(
    (badges ?? [])
      .flatMap((badge) => {
        const code = badge.code?.trim()
        const name = badge.name.trim().toLowerCase()
        return [code, name].filter(Boolean)
      }),
  )]
}

export function normalizeHookedAvatarPath(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

export function buildHookableUserPresentationKey(
  input: HookableUserPresentationKeyInput,
) {
  const roleBadgeKey = input.roleBadge === undefined ? "__undefined__" : input.roleBadge

  return JSON.stringify([
    input.userId ?? null,
    input.username?.trim() || null,
    input.displayName.trim(),
    input.avatarPath?.trim() || null,
    input.role?.trim() || null,
    input.status?.trim() || null,
    input.level ?? null,
    input.vipLevel ?? null,
    collectHookableBadgeCodes(input.badges),
    input.levelBadge ?? null,
    input.verificationBadge ?? null,
    roleBadgeKey,
    input.identityTags ?? null,
  ])
}
