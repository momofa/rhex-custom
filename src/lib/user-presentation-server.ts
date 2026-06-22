import "server-only"

import { executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { resolveHookedStringValue } from "@/lib/addon-hook-values"
import { formatNumber } from "@/lib/formatters"
import {
  buildHookableUserPresentationKey,
  collectHookableBadgeCodes,
  getDefaultPublicUserRoleBadge,
  normalizeHookedAvatarPath,
  normalizePublicUserIconText,
  type HookableUserBadge,
  type PublicUserDisplayedBadge,
  type PublicUserIdentityTag,
  type PublicUserIdentityTagTone,
  type PublicUserLevelBadge,
  type PublicUserRoleBadge,
  type PublicUserVerificationBadge,
} from "@/lib/user-presentation"
import { maskUserName, shouldMaskBannedUser } from "@/lib/user-display"

interface HookableUserPresentationInput {
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

interface HookedUserPresentationResult {
  displayName: string
  avatarPath: string | null
  publicUid: string | null
  levelBadge: PublicUserLevelBadge | null
  verificationBadge: PublicUserVerificationBadge | null
  displayedBadges: PublicUserDisplayedBadge[]
  roleBadge: PublicUserRoleBadge | null
  identityTags: PublicUserIdentityTag[]
}

const PUBLIC_COLOR_PATTERN = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i
const IDENTITY_TAG_TONES = new Set<PublicUserIdentityTagTone>([
  "plain",
  "vip",
  "level",
  "orange",
  "sky",
  "danger",
  "warning",
])

function normalizePresentationText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized ? normalized.slice(0, maxLength) : null
}

function normalizePresentationColor(value: unknown, fallback = "#64748b") {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return PUBLIC_COLOR_PATTERN.test(normalized) ? normalized : fallback
}

function normalizePublicUidValue(value: unknown) {
  return normalizePresentationText(value, 32)
}

function normalizeLevelBadgeValue(
  value: unknown,
  fallback: PublicUserLevelBadge | null = null,
): PublicUserLevelBadge | null {
  if (value === null) {
    return null
  }
  if (!value || typeof value !== "object") {
    return fallback
  }

  const record = value as Partial<PublicUserLevelBadge>
  const level = typeof record.level === "number" && Number.isFinite(record.level)
    ? Math.max(1, Math.trunc(record.level))
    : fallback?.level
  const name = normalizePresentationText(record.name, 32) ?? fallback?.name
  const color = normalizePresentationColor(record.color, fallback?.color ?? "#64748b")
  const icon = normalizePublicUserIconText(record.icon) ?? fallback?.icon

  if (!level || !name || !icon) {
    return fallback
  }

  return { level, name, color, icon }
}

function normalizeVerificationBadgeValue(
  value: unknown,
  fallback: PublicUserVerificationBadge | null = null,
): PublicUserVerificationBadge | null {
  if (value === null) {
    return null
  }
  if (!value || typeof value !== "object") {
    return fallback
  }

  const record = value as Partial<PublicUserVerificationBadge>
  const id = normalizePresentationText(record.id, 64) ?? fallback?.id
  const name = normalizePresentationText(record.name, 32) ?? fallback?.name
  const color = normalizePresentationColor(record.color, fallback?.color ?? "#2563eb")

  if (!id || !name) {
    return fallback
  }

  return {
    id,
    slug: normalizePresentationText(record.slug, 64) ?? fallback?.slug ?? null,
    name,
    color,
    iconText: normalizePublicUserIconText(record.iconText) ?? fallback?.iconText ?? null,
    customIconText: normalizePublicUserIconText(record.customIconText) ?? fallback?.customIconText ?? null,
    description: normalizePresentationText(record.description, 160) ?? fallback?.description ?? null,
    customDescription: normalizePresentationText(record.customDescription, 160) ?? fallback?.customDescription ?? null,
  }
}

function normalizeDisplayedBadgeValue(
  value: unknown,
  index: number,
): PublicUserDisplayedBadge | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const record = value as Partial<PublicUserDisplayedBadge>
  const name = normalizePresentationText(record.name, 32)
  if (!name) {
    return null
  }

  return {
    id: normalizePresentationText(record.id, 64) ?? `displayed-badge-${index}`,
    code: normalizePresentationText(record.code, 64),
    name,
    description: normalizePresentationText(record.description, 160),
    color: normalizePresentationColor(record.color),
    iconText: normalizePublicUserIconText(record.iconText),
    displayOrder: typeof record.displayOrder === "number" && Number.isFinite(record.displayOrder)
      ? Math.trunc(record.displayOrder)
      : index,
  }
}

function normalizeDisplayedBadgesValue(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const badges: PublicUserDisplayedBadge[] = []

  value.slice(0, 8).forEach((item, index) => {
    const badge = normalizeDisplayedBadgeValue(item, index)
    if (!badge || seen.has(badge.id)) {
      return
    }
    seen.add(badge.id)
    badges.push(badge)
  })

  return badges
}

function normalizeRoleBadgeValue(
  value: unknown,
  fallback: PublicUserRoleBadge | null = null,
): PublicUserRoleBadge | null {
  if (value === null) {
    return null
  }
  if (!value || typeof value !== "object") {
    return fallback
  }

  const record = value as Partial<PublicUserRoleBadge>
  const label = normalizePresentationText(record.label, 24)
  if (!label) {
    return fallback
  }

  const tone = IDENTITY_TAG_TONES.has(record.tone as PublicUserIdentityTagTone)
    ? record.tone as PublicUserIdentityTagTone
    : fallback?.tone

  return {
    key: normalizePresentationText(record.key, 64) ?? fallback?.key ?? "role",
    label,
    shortLabel: normalizePresentationText(record.shortLabel, 12) ?? fallback?.shortLabel ?? null,
    tone,
    tooltip: normalizePresentationText(record.tooltip, 80) ?? fallback?.tooltip ?? label,
  }
}

function normalizeIdentityTagValue(value: unknown, index: number): PublicUserIdentityTag | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const record = value as Partial<PublicUserIdentityTag>
  const label = normalizePresentationText(record.label, 24)
  if (!label) {
    return null
  }

  return {
    key: normalizePresentationText(record.key, 64) ?? `identity-tag-${index}`,
    label,
    tone: IDENTITY_TAG_TONES.has(record.tone as PublicUserIdentityTagTone)
      ? record.tone as PublicUserIdentityTagTone
      : "plain",
    tooltip: normalizePresentationText(record.tooltip, 80),
    order: typeof record.order === "number" && Number.isFinite(record.order)
      ? Math.trunc(record.order)
      : index,
  }
}

function normalizeIdentityTagsValue(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const tags: PublicUserIdentityTag[] = []

  value.slice(0, 12).forEach((item, index) => {
    const tag = normalizeIdentityTagValue(item, index)
    if (!tag || seen.has(tag.key)) {
      return
    }
    seen.add(tag.key)
    tags.push(tag)
  })

  return tags.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
}

async function resolveHookedUserPresentation(
  input: HookableUserPresentationInput,
): Promise<HookedUserPresentationResult> {
  const defaultPublicUid = typeof input.userId === "number"
    ? formatNumber(input.userId)
    : null
  const defaultLevelBadge = normalizeLevelBadgeValue(input.levelBadge, null)
  const defaultVerificationBadge = normalizeVerificationBadgeValue(input.verificationBadge, null)
  const defaultDisplayedBadges = normalizeDisplayedBadgesValue(input.badges ?? [])
  const defaultRoleBadge = normalizeRoleBadgeValue(
    input.roleBadge,
    getDefaultPublicUserRoleBadge(input.role),
  )
  const defaultIdentityTags = normalizeIdentityTagsValue(input.identityTags ?? [])

  if (shouldMaskBannedUser(input.status)) {
    return {
      displayName: maskUserName(input.displayName || input.username),
      avatarPath: null,
      publicUid: defaultPublicUid,
      levelBadge: defaultLevelBadge,
      verificationBadge: defaultVerificationBadge,
      displayedBadges: defaultDisplayedBadges,
      roleBadge: defaultRoleBadge,
      identityTags: defaultIdentityTags,
    }
  }

  const badgeCodes = collectHookableBadgeCodes(input.badges)
  const payload = {
    ...(typeof input.userId === "number" ? { userId: input.userId } : {}),
    ...(input.username?.trim() ? { username: input.username.trim() } : {}),
    ...(input.role?.trim() ? { role: input.role.trim() } : {}),
    ...(input.status?.trim() ? { status: input.status.trim() } : {}),
    ...(typeof input.level === "number" ? { level: input.level } : {}),
    ...(typeof input.vipLevel === "number" ? { vipLevel: input.vipLevel } : {}),
    ...(badgeCodes.length > 0 ? { badges: badgeCodes } : {}),
  }

  const [
    displayResult,
    avatarResult,
    publicUidResult,
    levelBadgeResult,
    verificationBadgeResult,
    displayedBadgesResult,
    roleBadgeResult,
    identityTagsResult,
  ] = await Promise.all([
    executeAddonWaterfallHook("user.displayName.value", input.displayName, {
      payload,
    }),
    executeAddonWaterfallHook("user.avatar.url.value", input.avatarPath?.trim() ?? "", {
      payload,
    }),
    typeof input.userId === "number"
      ? executeAddonWaterfallHook("user.publicUid.value", defaultPublicUid ?? String(input.userId), {
          payload: {
            userId: input.userId,
            ...(input.username?.trim() ? { username: input.username.trim() } : {}),
            ...(input.role?.trim() ? { role: input.role.trim() } : {}),
            ...(badgeCodes.length > 0 ? { badges: badgeCodes } : {}),
          },
        })
      : Promise.resolve({ value: defaultPublicUid ?? "", executions: [] }),
    executeAddonWaterfallHook("user.levelBadge.value", defaultLevelBadge, {
      payload,
    }),
    executeAddonWaterfallHook("user.verificationBadge.value", defaultVerificationBadge, {
      payload,
    }),
    executeAddonWaterfallHook("user.displayedBadges.items", defaultDisplayedBadges, {
      payload,
    }),
    executeAddonWaterfallHook("user.roleBadge.value", defaultRoleBadge, {
      payload,
    }),
    executeAddonWaterfallHook("user.identityTags.items", defaultIdentityTags, {
      payload,
    }),
  ])

  return {
    displayName: resolveHookedStringValue(input.displayName, displayResult.value).value,
    avatarPath: normalizeHookedAvatarPath(avatarResult.value),
    publicUid: normalizePublicUidValue(publicUidResult.value) ?? defaultPublicUid,
    levelBadge: normalizeLevelBadgeValue(levelBadgeResult.value, defaultLevelBadge),
    verificationBadge: normalizeVerificationBadgeValue(verificationBadgeResult.value, defaultVerificationBadge),
    displayedBadges: normalizeDisplayedBadgesValue(displayedBadgesResult.value),
    roleBadge: normalizeRoleBadgeValue(roleBadgeResult.value, defaultRoleBadge),
    identityTags: normalizeIdentityTagsValue(identityTagsResult.value),
  }
}

async function buildHookedUserPresentationMap(
  inputs: HookableUserPresentationInput[],
) {
  const uniqueInputs = [...new Map(
    inputs
      .filter((input) => input.displayName.trim())
      .map((input) => [buildHookableUserPresentationKey(input), input]),
  ).entries()]

  const resolved = await Promise.all(
    uniqueInputs.map(async ([key, input]) => [key, await resolveHookedUserPresentation(input)] as const),
  )

  return new Map<string, HookedUserPresentationResult>(resolved)
}

interface HookableSitePostItem {
  author: string
  authorId?: number
  authorUsername?: string
  authorAvatarPath?: string | null
  authorRole?: string
  authorStatus?: string
  authorLevel?: number | null
  authorVipLevel?: number | null
  authorLevelBadge?: PublicUserLevelBadge | null
  authorVerification?: PublicUserVerificationBadge | null
  authorDisplayedBadges?: readonly HookableUserBadge[]
  authorRoleBadge?: PublicUserRoleBadge | null
  authorIdentityTags?: readonly PublicUserIdentityTag[] | null
  isAnonymous?: boolean
  latestReplyAuthorName?: string | null
  latestReplyAuthorUsername?: string | null
}

export async function applyHookedUserPresentationToSitePosts<
  TItem extends HookableSitePostItem,
>(items: readonly TItem[]) {
  const inputs: HookableUserPresentationInput[] = []

  for (const item of items) {
    if (!item.isAnonymous && item.author.trim()) {
      inputs.push({
        userId: item.authorId,
        username: item.authorUsername,
        displayName: item.author,
        avatarPath: item.authorAvatarPath,
        role: item.authorRole,
        status: item.authorStatus,
        level: item.authorLevel,
        vipLevel: item.authorVipLevel,
        badges: item.authorDisplayedBadges,
        levelBadge: item.authorLevelBadge,
        verificationBadge: item.authorVerification,
        roleBadge: item.authorRoleBadge,
        identityTags: item.authorIdentityTags,
      })
    }

    if (item.latestReplyAuthorName?.trim() && item.latestReplyAuthorUsername?.trim()) {
      inputs.push({
        username: item.latestReplyAuthorUsername,
        displayName: item.latestReplyAuthorName,
      })
    }
  }

  const hookedMap = await buildHookedUserPresentationMap(inputs)

  return items.map((item) => {
    const authorKey = !item.isAnonymous && item.author.trim()
      ? buildHookableUserPresentationKey({
          userId: item.authorId,
          username: item.authorUsername,
          displayName: item.author,
          avatarPath: item.authorAvatarPath,
          role: item.authorRole,
          status: item.authorStatus,
          level: item.authorLevel,
          vipLevel: item.authorVipLevel,
          badges: item.authorDisplayedBadges,
          levelBadge: item.authorLevelBadge,
          verificationBadge: item.authorVerification,
          roleBadge: item.authorRoleBadge,
          identityTags: item.authorIdentityTags,
        })
      : null
    const latestReplyKey = item.latestReplyAuthorName?.trim() && item.latestReplyAuthorUsername?.trim()
      ? buildHookableUserPresentationKey({
          username: item.latestReplyAuthorUsername,
          displayName: item.latestReplyAuthorName,
        })
      : null
    const hookedAuthor = authorKey ? hookedMap.get(authorKey) : null
    const hookedLatestReply = latestReplyKey ? hookedMap.get(latestReplyKey) : null

    return {
      ...item,
      ...(hookedAuthor
        ? {
            author: hookedAuthor.displayName,
            authorAvatarPath: hookedAuthor.avatarPath,
            authorPublicUid: hookedAuthor.publicUid,
            authorLevelBadge: hookedAuthor.levelBadge,
            authorVerification: hookedAuthor.verificationBadge,
            authorDisplayedBadges: hookedAuthor.displayedBadges,
            authorRoleBadge: hookedAuthor.roleBadge,
            authorIdentityTags: hookedAuthor.identityTags,
          }
        : {}),
      ...(hookedLatestReply
        ? {
            latestReplyAuthorName: hookedLatestReply.displayName,
          }
        : {}),
    }
  })
}

interface HookableCommentEntry {
  author: string
  authorId: number
  authorUsername: string
  authorAvatarPath?: string | null
  authorRole?: string
  authorStatus?: string
  authorLevel?: number | null
  authorVipLevel?: number | null
  authorLevelBadge?: PublicUserLevelBadge | null
  authorVerification?: PublicUserVerificationBadge | null
  authorIsAnonymous?: boolean
  authorDisplayedBadges?: readonly HookableUserBadge[]
  authorRoleBadge?: PublicUserRoleBadge | null
  authorIdentityTags?: readonly PublicUserIdentityTag[] | null
}

function applyHookedPresentationToCommentEntry<TEntry extends HookableCommentEntry>(
  entry: TEntry,
  hookedMap: Map<string, HookedUserPresentationResult>,
) {
  if (entry.authorIsAnonymous || !entry.author.trim()) {
    return entry
  }

  const key = buildHookableUserPresentationKey({
    userId: entry.authorId,
    username: entry.authorUsername,
    displayName: entry.author,
    avatarPath: entry.authorAvatarPath,
    role: entry.authorRole,
    status: entry.authorStatus,
    level: entry.authorLevel,
    vipLevel: entry.authorVipLevel,
    badges: entry.authorDisplayedBadges,
    levelBadge: entry.authorLevelBadge,
    verificationBadge: entry.authorVerification,
    roleBadge: entry.authorRoleBadge,
    identityTags: entry.authorIdentityTags,
  })
  const hooked = hookedMap.get(key)

  if (!hooked) {
    return entry
  }

  return {
    ...entry,
    author: hooked.displayName,
    authorAvatarPath: hooked.avatarPath,
    authorPublicUid: hooked.publicUid,
    authorLevelBadge: hooked.levelBadge,
    authorVerification: hooked.verificationBadge,
    authorDisplayedBadges: hooked.displayedBadges,
    authorRoleBadge: hooked.roleBadge,
    authorIdentityTags: hooked.identityTags,
  }
}

export async function applyHookedUserPresentationToCommentThreads<
  TReply extends HookableCommentEntry,
  TComment extends HookableCommentEntry & { replies?: TReply[] },
>(items: readonly TComment[]) {
  const inputs: HookableUserPresentationInput[] = []

  for (const item of items) {
    if (!item.authorIsAnonymous && item.author.trim()) {
      inputs.push({
        userId: item.authorId,
        username: item.authorUsername,
        displayName: item.author,
        avatarPath: item.authorAvatarPath,
        role: item.authorRole,
        status: item.authorStatus,
        level: item.authorLevel,
        vipLevel: item.authorVipLevel,
        badges: item.authorDisplayedBadges,
        levelBadge: item.authorLevelBadge,
        verificationBadge: item.authorVerification,
        roleBadge: item.authorRoleBadge,
        identityTags: item.authorIdentityTags,
      })
    }

    for (const reply of item.replies ?? []) {
      if (!reply.authorIsAnonymous && reply.author.trim()) {
        inputs.push({
          userId: reply.authorId,
          username: reply.authorUsername,
          displayName: reply.author,
          avatarPath: reply.authorAvatarPath,
          role: reply.authorRole,
          status: reply.authorStatus,
          level: reply.authorLevel,
          vipLevel: reply.authorVipLevel,
          badges: reply.authorDisplayedBadges,
          levelBadge: reply.authorLevelBadge,
          verificationBadge: reply.authorVerification,
          roleBadge: reply.authorRoleBadge,
          identityTags: reply.authorIdentityTags,
        })
      }
    }
  }

  const hookedMap = await buildHookedUserPresentationMap(inputs)

  return items.map((item) => ({
    ...applyHookedPresentationToCommentEntry(item, hookedMap),
    replies: (item.replies ?? []).map((reply) => applyHookedPresentationToCommentEntry(reply, hookedMap)),
  }))
}

type FlatCommentEntry =
  | { type: "comment"; comment: HookableCommentEntry }
  | { type: "reply"; reply: HookableCommentEntry }

export async function applyHookedUserPresentationToFlatCommentItems<
  TItem extends FlatCommentEntry,
>(items: readonly TItem[]) {
  const inputs: HookableUserPresentationInput[] = []

  for (const item of items) {
    const entry = item.type === "comment" ? item.comment : item.reply
    if (entry.authorIsAnonymous || !entry.author.trim()) {
      continue
    }

    inputs.push({
      userId: entry.authorId,
      username: entry.authorUsername,
      displayName: entry.author,
      avatarPath: entry.authorAvatarPath,
      role: entry.authorRole,
      status: entry.authorStatus,
      level: entry.authorLevel,
      vipLevel: entry.authorVipLevel,
      badges: entry.authorDisplayedBadges,
      levelBadge: entry.authorLevelBadge,
      verificationBadge: entry.authorVerification,
      roleBadge: entry.authorRoleBadge,
      identityTags: entry.authorIdentityTags,
    })
  }

  const hookedMap = await buildHookedUserPresentationMap(inputs)

  return items.map((item) => {
    if (item.type === "comment") {
      return {
        ...item,
        comment: applyHookedPresentationToCommentEntry(item.comment, hookedMap),
      }
    }

    return {
      ...item,
      reply: applyHookedPresentationToCommentEntry(item.reply, hookedMap),
    }
  })
}

export async function applyHookedUserPresentationToNamedItem<
  TItem extends {
    displayName: string
    username: string
    avatarPath?: string | null
    role?: string | null
    status?: string | null
    level?: number | null
    vipLevel?: number | null
    levelName?: string | null
    levelColor?: string | null
    levelIcon?: string | null
    levelBadge?: PublicUserLevelBadge | null
    verification?: PublicUserVerificationBadge | null
    displayedBadges?: readonly HookableUserBadge[]
    roleBadge?: PublicUserRoleBadge | null
    identityTags?: readonly PublicUserIdentityTag[] | null
    id?: number
  },
>(item: TItem) {
  const levelBadge = item.levelBadge ?? (
    typeof item.level === "number" && item.levelName && item.levelColor && item.levelIcon
      ? {
          level: item.level,
          name: item.levelName,
          color: item.levelColor,
          icon: item.levelIcon,
        }
      : null
  )
  const hooked = await resolveHookedUserPresentation({
    userId: item.id,
    username: item.username,
    displayName: item.displayName,
    avatarPath: item.avatarPath,
    role: item.role,
    status: item.status,
    level: item.level,
    vipLevel: item.vipLevel,
    badges: item.displayedBadges,
    levelBadge,
    verificationBadge: item.verification,
    roleBadge: item.roleBadge,
    identityTags: item.identityTags,
  })

  return {
    ...item,
    displayName: hooked.displayName,
    avatarPath: hooked.avatarPath,
    publicUid: hooked.publicUid,
    level: hooked.levelBadge?.level ?? item.level,
    levelName: hooked.levelBadge?.name ?? item.levelName,
    levelColor: hooked.levelBadge?.color ?? item.levelColor,
    levelIcon: hooked.levelBadge?.icon ?? item.levelIcon,
    verification: hooked.verificationBadge,
    displayedBadges: hooked.displayedBadges,
    roleBadge: hooked.roleBadge,
    identityTags: hooked.identityTags,
  }
}

export async function applyHookedUserPresentationToHomeSidebarItems<
  TItem extends {
    authorName: string
    authorId?: number
    authorUsername?: string
    authorAvatarPath?: string | null
    lastReplyAuthorName?: string | null
    lastReplyAuthorUsername?: string | null
  },
>(items: readonly TItem[]) {
  const inputs: HookableUserPresentationInput[] = []

  for (const item of items) {
    if (item.authorName.trim()) {
      inputs.push({
        userId: item.authorId,
        username: item.authorUsername,
        displayName: item.authorName,
        avatarPath: item.authorAvatarPath,
      })
    }

    if (item.lastReplyAuthorName?.trim() && item.lastReplyAuthorUsername?.trim()) {
      inputs.push({
        username: item.lastReplyAuthorUsername,
        displayName: item.lastReplyAuthorName,
      })
    }
  }

  const hookedMap = await buildHookedUserPresentationMap(inputs)

  return items.map((item) => {
    const authorKey = item.authorName.trim()
      ? buildHookableUserPresentationKey({
          userId: item.authorId,
          username: item.authorUsername,
          displayName: item.authorName,
          avatarPath: item.authorAvatarPath,
        })
      : null
    const replyKey = item.lastReplyAuthorName?.trim() && item.lastReplyAuthorUsername?.trim()
      ? buildHookableUserPresentationKey({
          username: item.lastReplyAuthorUsername,
          displayName: item.lastReplyAuthorName,
        })
      : null
    const hookedAuthor = authorKey ? hookedMap.get(authorKey) : null
    const hookedReply = replyKey ? hookedMap.get(replyKey) : null

    return {
      ...item,
      ...(hookedAuthor
        ? {
            authorName: hookedAuthor.displayName,
            authorAvatarPath: hookedAuthor.avatarPath,
            authorPublicUid: hookedAuthor.publicUid,
          }
        : {}),
      ...(hookedReply
        ? {
            lastReplyAuthorName: hookedReply.displayName,
          }
        : {}),
    }
  })
}
