import type { Redis } from "ioredis"

import { REDIS_KEY_SCOPES } from "@/lib/redis-keys"
import { connectRedisClient, createRedisKey, getRedis, hasRedisUrl } from "@/lib/redis"
import { logRuntimeError } from "@/lib/runtime-errors"
import type { MessageConversationListItem } from "@/lib/message-types"

const DEFAULT_UNREAD_COUNT_CACHE_TTL_SECONDS = 45
const DEFAULT_CONVERSATION_LIST_CACHE_TTL_SECONDS = 20
const DEFAULT_SITE_CHAT_MESSAGES_CACHE_TTL_SECONDS = 15
const MESSAGE_USER_CACHE_VERSION_TTL_SECONDS = 24 * 60 * 60
const SITE_CHAT_CACHE_VERSION_TTL_SECONDS = 24 * 60 * 60

export interface CachedSiteChatMessageRecord {
  id: string
  body: string
  createdAt: Date
  senderId: number
  sender: {
    id: number
    username: string
    nickname: string | null
    avatarPath: string | null
  }
}

function readTtlSeconds(envKey: string, fallback: number) {
  const raw = process.env[envKey]?.trim()
  if (!raw) {
    return fallback
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(60 * 60, Math.max(1, Math.trunc(parsed)))
}

function getUnreadCountCacheTtlSeconds() {
  return readTtlSeconds("MESSAGE_UNREAD_COUNT_CACHE_TTL_SECONDS", DEFAULT_UNREAD_COUNT_CACHE_TTL_SECONDS)
}

function getConversationListCacheTtlSeconds() {
  return readTtlSeconds("MESSAGE_CONVERSATION_LIST_CACHE_TTL_SECONDS", DEFAULT_CONVERSATION_LIST_CACHE_TTL_SECONDS)
}

function getSiteChatMessagesCacheTtlSeconds() {
  return readTtlSeconds("SITE_CHAT_MESSAGES_CACHE_TTL_SECONDS", DEFAULT_SITE_CHAT_MESSAGES_CACHE_TTL_SECONDS)
}

function normalizeUserIds(userIds: number | number[]) {
  const values = Array.isArray(userIds) ? userIds : [userIds]
  return Array.from(new Set(values
    .filter((userId) => Number.isFinite(userId) && userId > 0)
    .map((userId) => Math.trunc(userId))))
}

function buildUnreadCountCacheKey(userId: number) {
  return createRedisKey(...REDIS_KEY_SCOPES.messages.unreadCount, userId)
}

function buildUserCacheVersionKey(userId: number) {
  return createRedisKey(...REDIS_KEY_SCOPES.messages.userCacheVersion, userId)
}

function buildConversationListCacheKey(userId: number, version: string) {
  return createRedisKey(...REDIS_KEY_SCOPES.messages.conversationList, userId, version)
}

function buildSiteChatVersionKey() {
  return createRedisKey(...REDIS_KEY_SCOPES.messages.siteChatVersion)
}

function buildSiteChatMessagesCacheKey(limit: number, version: string) {
  return createRedisKey(...REDIS_KEY_SCOPES.messages.siteChatMessages, limit, version)
}

function parseCachedUnreadCount(rawValue: string | null) {
  if (rawValue === null) {
    return null
  }

  const count = Number(rawValue)
  if (!Number.isSafeInteger(count) || count < 0) {
    return null
  }

  return count
}

function parseCachedConversationList(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    return Array.isArray(parsed) ? parsed as MessageConversationListItem[] : null
  } catch {
    return null
  }
}

function serializeSiteChatMessages(messages: CachedSiteChatMessageRecord[]) {
  return JSON.stringify(messages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
  })))
}

function parseCachedSiteChatMessages(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!Array.isArray(parsed)) {
      return null
    }

    return parsed.flatMap((item): CachedSiteChatMessageRecord[] => {
      if (!item || typeof item !== "object") {
        return []
      }

      const record = item as Partial<CachedSiteChatMessageRecord> & {
        createdAt?: unknown
        sender?: Partial<CachedSiteChatMessageRecord["sender"]> | null
      }
      const createdAt = typeof record.createdAt === "string" ? new Date(record.createdAt) : null
      if (
        typeof record.id !== "string"
        || typeof record.body !== "string"
        || !createdAt
        || Number.isNaN(createdAt.getTime())
        || typeof record.senderId !== "number"
        || !record.sender
        || typeof record.sender.id !== "number"
        || typeof record.sender.username !== "string"
      ) {
        return []
      }

      return [{
        id: record.id,
        body: record.body,
        createdAt,
        senderId: record.senderId,
        sender: {
          id: record.sender.id,
          username: record.sender.username,
          nickname: typeof record.sender.nickname === "string" ? record.sender.nickname : null,
          avatarPath: typeof record.sender.avatarPath === "string" ? record.sender.avatarPath : null,
        },
      }]
    })
  } catch {
    return null
  }
}

async function connectSharedRedis() {
  const redis = getRedis()
  await connectRedisClient(redis)
  return redis
}

async function readUserCacheVersion(redis: Redis, userId: number) {
  return await redis.get(buildUserCacheVersionKey(userId)) ?? "0"
}

function reportMessageCacheFallback(error: unknown, action: string, metadata?: Record<string, unknown>) {
  logRuntimeError(error, {
    area: "message-cache",
    action,
    message: "私信 Redis 缓存不可用，已回退到数据库路径",
    level: "warn",
    metadata,
  })
}

export async function getCachedUnreadMessageCount(userId: number, loader: () => Promise<number>) {
  if (!hasRedisUrl()) {
    return loader()
  }

  try {
    const redis = await connectSharedRedis()
    const key = buildUnreadCountCacheKey(userId)
    const cachedCount = parseCachedUnreadCount(await redis.get(key))

    if (cachedCount !== null) {
      return cachedCount
    }

    const count = await loader()
    await redis.set(key, String(Math.max(0, Math.trunc(count))), "EX", getUnreadCountCacheTtlSeconds())
    return count
  } catch (error) {
    reportMessageCacheFallback(error, "read-unread-count", { userId })
    return loader()
  }
}

export async function getCachedMessageConversationList(
  userId: number,
  loader: () => Promise<MessageConversationListItem[]>,
) {
  if (!hasRedisUrl()) {
    return loader()
  }

  try {
    const redis = await connectSharedRedis()
    const version = await readUserCacheVersion(redis, userId)
    const key = buildConversationListCacheKey(userId, version)
    const cachedConversations = parseCachedConversationList(await redis.get(key))

    if (cachedConversations) {
      return cachedConversations
    }

    const conversations = await loader()
    await redis.set(key, JSON.stringify(conversations), "EX", getConversationListCacheTtlSeconds())
    return conversations
  } catch (error) {
    reportMessageCacheFallback(error, "read-conversation-list", { userId })
    return loader()
  }
}

export async function getCachedSiteChatMessages(
  limit: number,
  loader: () => Promise<CachedSiteChatMessageRecord[]>,
) {
  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 1
  const normalizedLimit = Math.max(1, Math.min(100, requestedLimit))
  if (!hasRedisUrl()) {
    return loader()
  }

  try {
    const redis = await connectSharedRedis()
    const version = await redis.get(buildSiteChatVersionKey()) ?? "0"
    const key = buildSiteChatMessagesCacheKey(normalizedLimit, version)
    const cachedMessages = parseCachedSiteChatMessages(await redis.get(key))

    if (cachedMessages) {
      return cachedMessages
    }

    const messages = await loader()
    await redis.set(key, serializeSiteChatMessages(messages), "EX", getSiteChatMessagesCacheTtlSeconds())
    return messages
  } catch (error) {
    reportMessageCacheFallback(error, "read-site-chat-messages", { limit: normalizedLimit })
    return loader()
  }
}

export async function invalidateMessageUserCache(userIds: number | number[]) {
  const normalizedUserIds = normalizeUserIds(userIds)
  if (!hasRedisUrl() || normalizedUserIds.length === 0) {
    return
  }

  try {
    const redis = await connectSharedRedis()
    const pipeline = redis.pipeline()

    for (const userId of normalizedUserIds) {
      const versionKey = buildUserCacheVersionKey(userId)
      pipeline.del(buildUnreadCountCacheKey(userId))
      pipeline.incr(versionKey)
      pipeline.expire(versionKey, MESSAGE_USER_CACHE_VERSION_TTL_SECONDS)
    }

    await pipeline.exec()
  } catch (error) {
    reportMessageCacheFallback(error, "invalidate-user-cache", {
      userIds: normalizedUserIds,
    })
  }
}

export async function invalidateSiteChatCache() {
  if (!hasRedisUrl()) {
    return
  }

  try {
    const redis = await connectSharedRedis()
    const versionKey = buildSiteChatVersionKey()
    await redis.multi()
      .incr(versionKey)
      .expire(versionKey, SITE_CHAT_CACHE_VERSION_TTL_SECONDS)
      .exec()
  } catch (error) {
    reportMessageCacheFallback(error, "invalidate-site-chat-cache")
  }
}
