import { cache } from "react"

import { findAnonymousMaskUserById, type AnonymousMaskUserRecord } from "@/db/anonymous-post-queries"
import { getSiteSettings } from "@/lib/site-settings"
import { getUserDisplayName } from "@/lib/user-display"
import type {
  PublicUserDisplayedBadge,
  PublicUserIdentityTag,
  PublicUserLevelBadge,
  PublicUserRoleBadge,
  PublicUserVerificationBadge,
} from "@/lib/user-presentation"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

export interface AnonymousDisplayIdentity {
  id: number
  username: string
  name: string
  avatarPath?: string | null
  status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorIsVip?: boolean
  authorVipLevel?: number
  authorVerification?: PublicUserVerificationBadge | null
  authorDisplayedBadges?: PublicUserDisplayedBadge[]
  authorRoleBadge?: PublicUserRoleBadge | null
  authorIdentityTags?: PublicUserIdentityTag[]
}

function mapAnonymousIdentity(user: AnonymousMaskUserRecord): AnonymousDisplayIdentity {
  return {
    id: user.id,
    username: user.username,
    name: getUserDisplayName(user),
    avatarPath: user.avatarPath,
    status: user.status,
    authorIsVip: isVipActive(user),
    authorVipLevel: getVipLevel(user),
    authorVerification: user.verificationApplications?.[0]
        ? {
            id: user.verificationApplications[0].type.id,
            slug: user.verificationApplications[0].type.slug,
            name: user.verificationApplications[0].type.name,
            color: user.verificationApplications[0].type.color,
            iconText: user.verificationApplications[0].type.iconText,
            customIconText: user.verificationApplications[0].customIconText,
            description: user.verificationApplications[0].type.description,
            customDescription: user.verificationApplications[0].customDescription,
          }
      : null,
    authorDisplayedBadges: (user.userBadges ?? [])
      .filter((item) => Boolean(item.isDisplayed) && item.badge.status)
      .slice(0, 3)
      .map((item) => ({
        id: item.badge.id,
        code: item.badge.code,
        name: item.badge.name,
        description: item.badge.description,
        color: item.badge.color,
        iconText: item.badge.iconText,
      })),
  }
}

export function isAnonymousPost(post: { isAnonymous?: boolean | null }) {
  return Boolean(post.isAnonymous)
}

export function canUseAnonymousIdentityForPostReply(input: {
  post: { isAnonymous?: boolean | null; authorId?: number }
  currentUserId: number
}) {
  void input.currentUserId
  return isAnonymousPost(input.post)
}

export function applyAnonymousIdentityToPost<T extends {
  isAnonymous?: boolean
  author: string
  authorUsername?: string
  authorAvatarPath?: string | null
  authorRole?: "USER" | "MODERATOR" | "ADMIN"
  authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorLevel?: number | null
  authorLevelBadge?: PublicUserLevelBadge | null
  authorIsVip?: boolean
  authorVipLevel?: number | null
  authorVerification?: PublicUserVerificationBadge | null
  authorDisplayedBadges?: PublicUserDisplayedBadge[]
  authorRoleBadge?: PublicUserRoleBadge | null
  authorIdentityTags?: PublicUserIdentityTag[]
}>(post: T, maskIdentity: AnonymousDisplayIdentity | null) {
  if (!post.isAnonymous) {
    return post
  }

  return {
    ...post,
    author: maskIdentity?.name ?? maskIdentity?.username ?? "匿名用户",
    authorUsername: maskIdentity?.username ?? "anonymous-user",
    authorAvatarPath: maskIdentity?.avatarPath ?? null,
    authorRole: "USER" as const,
    authorStatus: maskIdentity?.status ?? "ACTIVE",
    authorLevel: undefined,
    authorLevelBadge: null,
    authorIsVip: maskIdentity?.authorIsVip ?? false,
    authorVipLevel: maskIdentity?.authorVipLevel ?? 0,
    authorVerification: maskIdentity?.authorVerification ?? null,
    authorDisplayedBadges: maskIdentity?.authorDisplayedBadges ?? [],
    authorRoleBadge: maskIdentity?.authorRoleBadge ?? null,
    authorIdentityTags: maskIdentity?.authorIdentityTags ?? [],
  }
}

export const getAnonymousMaskDisplayIdentity = cache(async (): Promise<AnonymousDisplayIdentity | null> => {
  const settings = await getSiteSettings()

  if (!settings.anonymousPostEnabled || !settings.anonymousPostMaskUserId) {
    return null
  }

  const user = await findAnonymousMaskUserById(settings.anonymousPostMaskUserId)
  return user ? mapAnonymousIdentity(user) : null
})
