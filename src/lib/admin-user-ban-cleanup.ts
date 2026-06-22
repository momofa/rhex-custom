import { revalidatePath } from "next/cache"

import { prisma } from "@/db/client"
import { CommentStatus, PostStatus, Prisma } from "@/db/types"
import { expireContentListCachesImmediately } from "@/lib/content-list-cache"
import { formatMonthDayTime } from "@/lib/formatters"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { messageEventBus } from "@/lib/message-event-bus"
import { invalidateSiteChatCache } from "@/lib/message-redis-cache"
import { revalidatePostCommentCache, revalidatePostDetailCache } from "@/lib/post-detail-cache"
import { SITE_CHAT_CONVERSATION_ID, SITE_CHAT_ROOM_DB_ID } from "@/lib/site-chat"
import { getServerSiteSettings } from "@/lib/site-settings"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"
import { getUserDisplayName } from "@/lib/user-display"
import { mergeUserProfileSettings, resolveUserProfileSettings } from "@/lib/user-profile-settings"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export interface UserBanCleanupOptions {
  offlineAllPosts: boolean
  offlineAllComments: boolean
  clearProfile: boolean
  clearSiteChatMessages: boolean
}

export interface UserBanCleanupResult {
  offlinePosts: number
  offlineComments: number
  profileCleared: boolean
  profileIntroductionSkipped: boolean
  siteChatMessagesDeleted: number
  siteChatSkipped: boolean
}

type PostCacheTarget = {
  id: string
  slug: string
}

type CommentCacheTarget = {
  postId: string
  post: {
    slug: string
  }
}

type SiteChatLatestMessage = {
  id: string
  body: string
  createdAt: Date
  senderId: number
  sender: {
    username: string
    nickname: string | null
    avatarPath: string | null
  }
}

const EMPTY_CLEANUP_RESULT: UserBanCleanupResult = {
  offlinePosts: 0,
  offlineComments: 0,
  profileCleared: false,
  profileIntroductionSkipped: false,
  siteChatMessagesDeleted: 0,
  siteChatSkipped: false,
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const key = getKey(item)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(item)
  }

  return result
}

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    if (type) {
      revalidatePath(path, type)
      return
    }

    revalidatePath(path)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidatePath")
      || message.includes('used "revalidatePath ')
    ) {
      return
    }

    throw error
  }
}

function revalidateBanCleanupCaches(input: {
  userId: number
  posts?: PostCacheTarget[]
  commentPosts?: CommentCacheTarget[]
  profileChanged?: boolean
}) {
  revalidateUserSurfaceCache(input.userId)

  if (input.posts?.length || input.commentPosts?.length) {
    expireContentListCachesImmediately()
    expireTaxonomyCacheImmediately()
    revalidateHomeSidebarStatsCache()
    safeRevalidatePath("/")
    safeRevalidatePath("/latest")
    safeRevalidatePath("/new")
    safeRevalidatePath("/hot")
    safeRevalidatePath("/following")
    safeRevalidatePath("/admin")
    safeRevalidatePath("/users/[username]", "page")
    safeRevalidatePath("/posts/[slug]", "page")
    safeRevalidatePath("/boards/[slug]", "page")
    safeRevalidatePath("/zones/[slug]", "page")
    safeRevalidatePath("/tags/[slug]", "page")
  }

  if (input.profileChanged) {
    safeRevalidatePath("/users/[username]", "page")
    safeRevalidatePath("/admin")
  }

  for (const post of uniqueBy(input.posts ?? [], (item) => item.id)) {
    revalidatePostDetailCache({ postId: post.id, slug: post.slug })
  }

  for (const commentPost of uniqueBy(input.commentPosts ?? [], (item) => item.postId)) {
    revalidatePostCommentCache({ postId: commentPost.postId, slug: commentPost.post.slug })
  }
}

function hasAnyCleanupOption(options: UserBanCleanupOptions) {
  return options.offlineAllPosts
    || options.offlineAllComments
    || options.clearProfile
    || options.clearSiteChatMessages
}

async function offlineUserPosts(userId: number, reason: string) {
  const posts = await prisma.post.findMany({
    where: {
      authorId: userId,
      status: {
        not: PostStatus.OFFLINE,
      },
    },
    select: {
      id: true,
      slug: true,
    },
  })

  if (posts.length === 0) {
    return posts
  }

  await prisma.post.updateMany({
    where: {
      id: {
        in: posts.map((post) => post.id),
      },
    },
    data: {
      status: PostStatus.OFFLINE,
      reviewNote: reason,
    },
  })

  return posts
}

async function offlineUserComments(userId: number, adminUserId: number, reason: string) {
  const comments = await prisma.comment.findMany({
    where: {
      userId,
      status: {
        not: CommentStatus.HIDDEN,
      },
    },
    select: {
      id: true,
      postId: true,
      post: {
        select: {
          slug: true,
        },
      },
    },
  })

  if (comments.length === 0) {
    return comments
  }

  await prisma.comment.updateMany({
    where: {
      id: {
        in: comments.map((comment) => comment.id),
      },
    },
    data: {
      status: CommentStatus.HIDDEN,
      reviewNote: reason,
      reviewedById: adminUserId,
      reviewedAt: new Date(),
    },
  })

  return comments
}

async function clearUserProfile(userId: number) {
  const [settings, user] = await Promise.all([
    getServerSiteSettings(),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        bio: true,
        signature: true,
      },
    }),
  ])

  if (!user) {
    return {
      cleared: false,
      introductionSkipped: !settings.userProfileIntroductionEnabled,
    }
  }

  const updateData: Prisma.UserUpdateInput = {}
  let cleared = false
  const shouldClearBio = Boolean(user.bio?.trim())
  const profileSettings = resolveUserProfileSettings(user.signature)
  const shouldClearIntroduction = settings.userProfileIntroductionEnabled && Boolean(profileSettings.introduction.trim())

  if (shouldClearBio) {
    updateData.bio = null
    cleared = true
  }

  if (shouldClearIntroduction) {
    updateData.signature = mergeUserProfileSettings(user.signature, {
      introduction: "",
    })
    cleared = true
  }

  if (cleared) {
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })
  }

  return {
    cleared,
    introductionSkipped: !settings.userProfileIntroductionEnabled,
  }
}

function mapSiteChatLatestMessage(message: SiteChatLatestMessage | null) {
  if (!message) {
    return undefined
  }

  return {
    messageId: message.id,
    content: message.body,
    createdAtLabel: formatMonthDayTime(message.createdAt),
    senderId: message.senderId,
    senderUsername: message.sender.username,
    senderDisplayName: getUserDisplayName(message.sender),
    senderAvatarPath: message.sender.avatarPath,
    occurredAt: message.createdAt.toISOString(),
  }
}

async function clearUserSiteChatMessages(userId: number, adminUserId: number) {
  const settings = await getServerSiteSettings()

  if (!settings.messageEnabled || !settings.siteChatEnabled) {
    return {
      deletedCount: 0,
      skipped: true,
    }
  }

  const messages = await prisma.directMessage.findMany({
    where: {
      conversationId: SITE_CHAT_ROOM_DB_ID,
      senderId: userId,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
    },
  })

  if (messages.length === 0) {
    return {
      deletedCount: 0,
      skipped: false,
    }
  }

  const messageIds = messages.map((message) => message.id)
  const latestMessage = await prisma.$transaction(async (tx) => {
    await tx.directMessage.deleteMany({
      where: {
        id: {
          in: messageIds,
        },
      },
    })

    const latest = await tx.directMessage.findFirst({
      where: {
        conversationId: SITE_CHAT_ROOM_DB_ID,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderId: true,
        sender: {
          select: {
            username: true,
            nickname: true,
            avatarPath: true,
          },
        },
      },
    })

    await tx.conversation.updateMany({
      where: {
        id: SITE_CHAT_ROOM_DB_ID,
      },
      data: {
        lastMessageAt: latest?.createdAt ?? new Date(0),
      },
    })

    await tx.conversationParticipant.updateMany({
      where: {
        conversationId: SITE_CHAT_ROOM_DB_ID,
      },
      data: {
        unreadCount: 0,
        lastReadMessageId: latest?.id ?? null,
      },
    })

    return latest
  })

  await invalidateSiteChatCache()

  const occurredAt = new Date().toISOString()
  const latestMessagePayload = mapSiteChatLatestMessage(latestMessage)
  for (const messageId of messageIds) {
    await messageEventBus.publish({
      type: "message.deleted",
      conversationId: SITE_CHAT_CONVERSATION_ID,
      messageId,
      deletedByUserId: adminUserId,
      latestMessage: latestMessagePayload,
      broadcast: "site-chat",
      occurredAt,
    })
  }

  return {
    deletedCount: messageIds.length,
    skipped: false,
  }
}

export async function runUserBanCleanupActions(input: {
  userId: number
  adminUserId: number
  options: UserBanCleanupOptions
  reason: string
}): Promise<UserBanCleanupResult> {
  if (!hasAnyCleanupOption(input.options)) {
    return EMPTY_CLEANUP_RESULT
  }

  const result: UserBanCleanupResult = { ...EMPTY_CLEANUP_RESULT }
  const postTargets = input.options.offlineAllPosts
    ? await offlineUserPosts(input.userId, input.reason)
    : []
  const commentTargets = input.options.offlineAllComments
    ? await offlineUserComments(input.userId, input.adminUserId, input.reason)
    : []
  const profileResult = input.options.clearProfile
    ? await clearUserProfile(input.userId)
    : { cleared: false, introductionSkipped: false }
  const siteChatResult = input.options.clearSiteChatMessages
    ? await clearUserSiteChatMessages(input.userId, input.adminUserId)
    : { deletedCount: 0, skipped: false }

  result.offlinePosts = postTargets.length
  result.offlineComments = commentTargets.length
  result.profileCleared = profileResult.cleared
  result.profileIntroductionSkipped = profileResult.introductionSkipped
  result.siteChatMessagesDeleted = siteChatResult.deletedCount
  result.siteChatSkipped = siteChatResult.skipped

  revalidateBanCleanupCaches({
    userId: input.userId,
    posts: postTargets,
    commentPosts: commentTargets,
    profileChanged: result.profileCleared,
  })

  return result
}

export function formatUserBanCleanupSummary(result: UserBanCleanupResult) {
  const parts = [
    result.offlinePosts > 0 ? `下线帖子 ${result.offlinePosts} 篇` : null,
    result.offlineComments > 0 ? `下线评论 ${result.offlineComments} 条` : null,
    result.profileCleared ? "清空个人资料" : null,
    result.profileIntroductionSkipped ? "个人介绍功能未开启" : null,
    result.siteChatMessagesDeleted > 0 ? `清空聊天室发言 ${result.siteChatMessagesDeleted} 条` : null,
    result.siteChatSkipped ? "全站聊天室未开启" : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join("，") : ""
}
