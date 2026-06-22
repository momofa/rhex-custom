import type { Comment, LotteryCondition, LotteryParticipant, LotteryPrize, LotteryWinner, PollOption, PollVote, Post, PostAppendix, PostAttachment, PostAttachmentSourceType, User } from "@/db/types"
import { unstable_cache } from "next/cache"



import type { LocalPostType } from "@/lib/post-types"
import { mapLotteryView } from "@/lib/lottery"
import type { AnonymousDisplayIdentity } from "@/lib/post-anonymous"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"

import { getPublicPostContentText, parsePostContentDocument } from "@/lib/post-content"
import {
  getPostDetailDataCacheTag,
  getPostDetailSlugCacheTag,
  getPostSeoCacheTag,
  getPostViewerCacheTag,
  POST_DETAIL_CACHE_REVALIDATE_SECONDS,
  POST_DETAIL_DATA_CACHE_TAG,
  POST_PERSONALIZED_CACHE_REVALIDATE_SECONDS,
  POST_SEO_CACHE_TAG,
} from "@/lib/post-detail-cache"
import type { PostAuctionSummary } from "@/lib/post-auctions"
import type { PostRedPacketSummary } from "@/lib/post-red-packets"
import type { PostTipSummary } from "@/lib/post-tips"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { withRuntimeFallback } from "@/lib/runtime-errors"
import type { SiteTippingGiftItem } from "@/lib/site-settings"


import { findEditablePostBySlug, findHomepagePosts, findPostDetailById, findPostDetailBySlug, findPostRouteIdentityBySlug, findPostSeoBySlug } from "@/db/post-queries"
import { recordPostViewCount } from "@/lib/post-view-count-buffer"

import { mapListPost } from "@/lib/post-map"
import { applyHookedUserPresentationToSitePosts } from "@/lib/user-presentation-server"
import type {
  PublicUserDisplayedBadge,
  PublicUserIdentityTag,
  PublicUserLevelBadge,
  PublicUserRoleBadge,
  PublicUserVerificationBadge,
} from "@/lib/user-presentation"





type ListPostBoard = {
  name: string
  slug: string
  iconPath?: string | null
}

type ListPostAuthor = Pick<User, "id" | "username" | "nickname" | "avatarPath" | "role" | "status" | "level" | "vipLevel" | "vipExpiresAt"> & {
  userBadges?: Array<{
    id: string
    isDisplayed?: boolean
    displayOrder?: number
    badge: {
      id: string
      code: string
      name: string
      description?: string | null
      color: string
      iconText?: string | null
      status: boolean
    }
  }>
  verificationApplications?: Array<{
    customIconText?: string | null
    customDescription?: string | null
    type: {
      id: string
      slug?: string | null
      name: string
      color: string
      iconText?: string | null
      description?: string | null
    }
  }>
}

interface PostDetailRelations {
  board: ListPostBoard
  author: ListPostAuthor
  acceptedComment: (Comment & { user: User }) | null
  pollOptions: Array<PollOption & { votes: PollVote[] }>
  lotteryPrizes: Array<LotteryPrize & { winners: Array<LotteryWinner & { user: Pick<User, "username" | "nickname" | "avatarPath"> }> }>
  lotteryConditions: LotteryCondition[]
  lotteryParticipants: Array<LotteryParticipant & { user: Pick<User, "username" | "nickname" | "avatarPath" | "status"> }>
  appendices: PostAppendix[]
  attachments: Array<PostAttachment & {
    upload: {
      id: string
      originalName: string
      fileName: string
      fileExt: string
      mimeType: string
      fileSize: number
      storagePath: string
      urlPath: string
    } | null
  }>
  likes?: Array<{ userId: number }>
  favorites?: Array<{ userId: number }>
}



export interface PostSeoData {
  id: string
  slug: string
  title: string
  description: string
}


export interface SitePostItem {

  id: string
  slug: string
  title: string
  description: string
  board: string
  boardIcon: string
  boardSlug?: string
  isAnonymous?: boolean
  author: string
  authorId?: number
  authorPublicUid?: string | null
  authorUsername?: string
  authorIsAiAgent?: boolean
  authorAvatarPath?: string | null
  authorRole?: "USER" | "MODERATOR" | "ADMIN"
  authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorLevel?: number
  authorIsVip?: boolean
  authorVipLevel?: number
  authorLevelBadge?: PublicUserLevelBadge | null
  authorVerification?: PublicUserVerificationBadge | null
  authorDisplayedBadges?: PublicUserDisplayedBadge[]
  authorRoleBadge?: PublicUserRoleBadge | null
  authorIdentityTags?: PublicUserIdentityTag[]

  publishedAt: string
  publishedAtRaw?: string
  lastRepliedAt?: string
  lastRepliedAtRaw?: string
  latestReplyAuthorName?: string | null
  latestReplyAuthorUsername?: string | null
  latestReplyCommentId?: string | null
  latestReplyExcerpt?: string | null

  excerpt: string
  coverImage?: string | null
  contentMarkdown: string
  content: string[]
  commentsVisibleToAuthorOnly?: boolean
  contentBlocks?: Array<{
    id: string
    type: "PUBLIC" | "AUTHOR_ONLY" | "LOGIN_UNLOCK" | "REPLY_UNLOCK" | "PURCHASE_UNLOCK"
    text: string
    visible: boolean
    replyThreshold?: number
    price?: number
    purchaseCount?: number
  }>

  editableUntil?: string | null
  createdAt?: string
  appendedContent?: string | null
  lastAppendedAt?: string | null
  appendices?: Array<{
    id: string
    floor: number
    content: string
    createdAt: string
  }>
  hasAttachments?: boolean
  attachments?: Array<{
    id: string
    sourceType: PostAttachmentSourceType
    name: string
    fileExt?: string | null
    mimeType?: string | null
    fileSize?: number | null
    minDownloadLevel: number
    minDownloadVipLevel: number
    pointsCost: number
    requireReplyUnlock: boolean
    downloadCount: number
  }>

  type: LocalPostType


  typeLabel: string
  status: string
  statusLabel: string
  reviewNote?: string | null
  isPinned: boolean
  pinScope?: string | null
  hasRedPacket?: boolean
  rewardMode?: PostRewardPoolMode
  minViewLevel?: number
  minViewVipLevel?: number
  isFeatured: boolean

  bounty?: {
    points: number
    acceptedCommentId?: string | null
    acceptedAnswerAuthor?: string | null
    isResolved: boolean
  }
  auction?: PostAuctionSummary
  poll?: {
    totalVotes: number
    hasVoted: boolean
    expiresAt?: string | null
    options: Array<{
      id: string
      content: string
      voteCount: number
      percentage: number
      isVoted: boolean
    }>
  }
  lottery?: ReturnType<typeof mapLotteryView>
  redPacket?: PostRedPacketSummary
  tipping?: {

    enabled: boolean
    isLoggedIn: boolean
    pointName: string
    currentUserPoints: number
    gifts: SiteTippingGiftItem[]
    giftStats: PostTipSummary["giftStats"]
    recentGiftEvents: PostTipSummary["recentGiftEvents"]
    allowedAmounts: number[]
    dailyLimit: number
    perPostLimit: number
    usedDailyCount: number
    usedPostCount: number
    totalCount: number
    totalPoints: number
    topSupporters: PostTipSummary["topSupporters"]
  }


  stats: {
    comments: number
    likes: number
    favorites: number
    views: number
    tips: number
    tipPoints: number
  }

  viewerState?: {
    liked: boolean
    favored: boolean
  }
}


function mapDatabasePost(post: Post & { board: ListPostBoard; author: ListPostAuthor }, anonymousMaskIdentity: AnonymousDisplayIdentity | null = null): SitePostItem {
  return mapListPost(post, anonymousMaskIdentity)
}


function mapPostDetail(
  post: Post & PostDetailRelations,
  currentUserId?: number,
  options?: { isAdmin?: boolean; userReplyCount?: number; purchasedBlockIds?: Set<string>; purchasedBlockBuyerCounts?: Map<string, number>; tipSummary?: PostTipSummary; redPacketSummary?: PostRedPacketSummary; auctionSummary?: PostAuctionSummary | null; anonymousMaskIdentity?: AnonymousDisplayIdentity | null },
): SitePostItem {
  const totalVotes = post.pollOptions.reduce((sum, option) => sum + option.voteCount, 0)
  const tipSummary = options?.tipSummary
  const redPacketSummary = options?.redPacketSummary

  const contentBlocks = parsePostContentDocument(post.content).blocks.map((block) => {

    const isOwner = Boolean(currentUserId && currentUserId === post.authorId)
    const isAdmin = Boolean(options?.isAdmin)
    const replyCount = options?.userReplyCount ?? 0
    const purchasedBlockIds = options?.purchasedBlockIds ?? new Set<string>()
    const purchasedBlockBuyerCounts = options?.purchasedBlockBuyerCounts ?? new Map<string, number>()
    const replyUnlocked = isOwner || isAdmin || replyCount >= (block.replyThreshold ?? 1)
    const visible = block.type === "PUBLIC"
      || (block.type === "AUTHOR_ONLY" && (isOwner || isAdmin))
      || (block.type === "LOGIN_UNLOCK" && (Boolean(currentUserId) || isOwner || isAdmin))
      || (block.type === "REPLY_UNLOCK" && replyUnlocked)
      || (block.type === "PURCHASE_UNLOCK" && (purchasedBlockIds.has(block.id) || isOwner || isAdmin))


    return {
      id: block.id,
      type: block.type,
      text: block.text,
      visible,
      replyThreshold: block.replyThreshold,
      price: block.price,
      purchaseCount: block.type === "PURCHASE_UNLOCK" ? (purchasedBlockBuyerCounts.get(block.id) ?? 0) : undefined,
    }
  })

  return {
    ...mapDatabasePost(post, options?.anonymousMaskIdentity ?? null),
    boardSlug: post.board.slug,
    commentsVisibleToAuthorOnly: post.commentsVisibleToAuthorOnly,
    contentBlocks,

    editableUntil: post.editableUntil?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    appendedContent: post.appendedContent ?? null,
    lastAppendedAt: post.lastAppendedAt?.toISOString() ?? null,
    appendices: post.appendices
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item, index) => ({
        id: item.id,
        floor: index + 1,
        content: getPublicPostContentText(item.content),
        createdAt: item.createdAt.toISOString(),
      })),
    attachments: post.attachments
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((attachment) => ({
        id: attachment.id,
        sourceType: attachment.sourceType,
        name: attachment.name,
        fileExt: attachment.fileExt ?? attachment.upload?.fileExt ?? null,
        mimeType: attachment.mimeType ?? attachment.upload?.mimeType ?? null,
        fileSize: attachment.fileSize ?? attachment.upload?.fileSize ?? null,
        minDownloadLevel: attachment.minDownloadLevel,
        minDownloadVipLevel: attachment.minDownloadVipLevel,
        pointsCost: attachment.pointsCost,
        requireReplyUnlock: attachment.requireReplyUnlock,
        downloadCount: attachment.downloadCount,
      })),

    bounty: post.type === "BOUNTY"

      ? {
          points: post.bountyPoints ?? 0,
          acceptedCommentId: post.acceptedCommentId,
          acceptedAnswerAuthor: post.acceptedComment?.user.nickname ?? post.acceptedComment?.user.username ?? null,
          isResolved: Boolean(post.acceptedCommentId),
        }
      : undefined,
    auction: post.type === "AUCTION" ? (options?.auctionSummary ?? undefined) : undefined,
    poll: post.type === "POLL"
      ? {
          totalVotes,
          hasVoted: post.pollOptions.some((option) => option.votes.some((vote) => vote.userId === currentUserId)),
          expiresAt: post.pollExpiresAt?.toISOString() ?? null,
          options: post.pollOptions

            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((option) => ({
              id: option.id,
              content: option.content,
              voteCount: option.voteCount,
              percentage: totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0,
              isVoted: option.votes.some((vote) => vote.userId === currentUserId),
            })),
        }
      : undefined,
    lottery: mapLotteryView(post, currentUserId),
    redPacket: redPacketSummary,
    tipping: tipSummary ? {

      enabled: tipSummary.enabled,
      isLoggedIn: tipSummary.isLoggedIn,
      pointName: tipSummary.pointName,
      currentUserPoints: tipSummary.currentUserPoints,
      gifts: tipSummary.gifts,
      giftStats: tipSummary.giftStats,
      recentGiftEvents: tipSummary.recentGiftEvents,
      allowedAmounts: tipSummary.allowedAmounts,
      dailyLimit: tipSummary.dailyLimit,
      perPostLimit: tipSummary.perPostLimit,
      usedDailyCount: tipSummary.usedDailyCount,
      usedPostCount: tipSummary.usedPostCount,
      totalCount: tipSummary.tipCount,
      totalPoints: tipSummary.tipTotalPoints,
      topSupporters: tipSummary.topSupporters,
    } : {
      enabled: false,
      isLoggedIn: false,
      pointName: "积分",
      currentUserPoints: 0,
      gifts: [],
      giftStats: [],
      recentGiftEvents: [],
      allowedAmounts: [],
      dailyLimit: 0,
      perPostLimit: 0,
      usedDailyCount: 0,
      usedPostCount: 0,
      totalCount: post.tipCount,
      totalPoints: post.tipTotalPoints,
      topSupporters: [],
    },

    viewerState: {
      liked: Boolean(currentUserId && post.likes?.some((item) => item.userId === currentUserId)),
      favored: Boolean(currentUserId && post.favorites?.some((item) => item.userId === currentUserId)),
    },
  }
}


export async function getHomepagePosts(page = 1, pageSize = 20): Promise<SitePostItem[]> {
  return withRuntimeFallback(async () => {
    const [posts, anonymousMaskIdentity] = await Promise.all([
      findHomepagePosts(page, pageSize),
      getAnonymousMaskDisplayIdentity(),
    ])
    return applyHookedUserPresentationToSitePosts(
      posts.map((post) => mapDatabasePost(post, anonymousMaskIdentity)),
    )
  }, {
    area: "posts",
    action: "getHomepagePosts",
    message: "首页帖子加载失败",
    metadata: { page, pageSize },
    fallback: [],
  })
}

type PostDetailOptions = { isAdmin?: boolean; userReplyCount?: number; purchasedBlockIds?: Set<string>; purchasedBlockBuyerCounts?: Map<string, number>; tipSummary?: PostTipSummary; redPacketSummary?: PostRedPacketSummary; auctionSummary?: PostAuctionSummary | null }

async function mapPostDetailRecord(
  post: Post & PostDetailRelations,
  currentUserId?: number,
  options?: PostDetailOptions,
) {
  const anonymousMaskIdentity = await getAnonymousMaskDisplayIdentity()
  const mappedPost = mapPostDetail(post, currentUserId, {
    ...options,
    anonymousMaskIdentity,
  })
  const [presentationHookedPost] = await applyHookedUserPresentationToSitePosts([mappedPost])
  return presentationHookedPost ?? mappedPost
}

async function readPostDetailById(postId: string, currentUserId?: number): Promise<SitePostItem | null> {
  const post = await findPostDetailById(postId, currentUserId)

  if (!post) {
    return null
  }

  return mapPostDetailRecord(post, currentUserId)
}

async function readPostDetailBySlug(
  slug: string,
  currentUserId?: number,
  options?: PostDetailOptions,
): Promise<SitePostItem | null> {
  const post = await findPostDetailBySlug(slug, currentUserId)

  if (!post) {
    return null
  }

  return mapPostDetailRecord(post, currentUserId, options)
}

async function getPersistentPostDetailById(postId: string, canonicalSlug: string, currentUserId?: number) {
  const viewerKey = currentUserId ? `user:${currentUserId}` : "guest"
  const viewerTags = currentUserId ? [getPostViewerCacheTag(currentUserId)] : []

  return unstable_cache(
    async () => readPostDetailById(postId, currentUserId),
    [POST_DETAIL_DATA_CACHE_TAG, postId, viewerKey],
    {
      tags: [
        POST_DETAIL_DATA_CACHE_TAG,
        getPostDetailDataCacheTag(postId),
        getPostDetailSlugCacheTag(canonicalSlug),
        ...viewerTags,
      ],
      revalidate: POST_PERSONALIZED_CACHE_REVALIDATE_SECONDS,
    },
  )()
}


export async function getPostDetailBySlug(
  slug: string,
  currentUserId?: number,
  options?: PostDetailOptions,
): Promise<SitePostItem | null> {

  try {
    if (options) {
      return await readPostDetailBySlug(slug, currentUserId, options)
    }

    const routeIdentity = await findPostRouteIdentityBySlug(slug)

    if (!routeIdentity) {
      return null
    }

    return await getPersistentPostDetailById(routeIdentity.id, routeIdentity.slug, currentUserId)
  } catch (error) {
    console.error(error)
    return null
  }
}

export async function getEditablePostBySlug(slug: string) {
  return findEditablePostBySlug(slug)
}


async function readPostSeoBySlug(slug: string): Promise<PostSeoData | null> {
  const post = await findPostSeoBySlug(slug)

  if (!post) {
    return null
  }

  const parsed = parsePostContentDocument(post.content)
  const fallbackDescription = parsed.blocks
    .filter((block) => block.type === "PUBLIC")
    .map((block) => block.summary || block.text)
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.summary?.trim() || fallbackDescription,
  }
}

async function getPersistentPostSeoBySlug(slug: string) {
  return unstable_cache(
    async () => readPostSeoBySlug(slug),
    [POST_SEO_CACHE_TAG, slug],
    {
      tags: [POST_SEO_CACHE_TAG, getPostSeoCacheTag(slug)],
      revalidate: POST_DETAIL_CACHE_REVALIDATE_SECONDS,
    },
  )()
}

export async function getPostSeoBySlug(slug: string): Promise<PostSeoData | null> {
  try {
    return await getPersistentPostSeoBySlug(slug)
  } catch (error) {
    console.error(error)
    return null
  }
}




export async function incrementPostViewCount(postId: string) {
  await withRuntimeFallback(async () => {
    await recordPostViewCount(postId)
  }, {
    area: "posts",
    action: "incrementPostViewCount",
    message: "帖子浏览量更新失败",
    metadata: { postId },
    fallback: undefined,
    level: "warn",
  })
}




