import { REDIS_KEY_SCOPES } from "@/lib/redis-keys"
import { connectRedisClient, createRedisKey, getRedis, hasRedisUrl } from "@/lib/redis"
import { logRuntimeError } from "@/lib/runtime-errors"

const DEFAULT_UNREAD_COUNT_CACHE_TTL_SECONDS = 45

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
  return readTtlSeconds("NOTIFICATION_UNREAD_COUNT_CACHE_TTL_SECONDS", DEFAULT_UNREAD_COUNT_CACHE_TTL_SECONDS)
}

function normalizeUserIds(userIds: number | number[]) {
  const values = Array.isArray(userIds) ? userIds : [userIds]
  return Array.from(new Set(values
    .filter((userId) => Number.isFinite(userId) && userId > 0)
    .map((userId) => Math.trunc(userId))))
}

function buildUnreadCountCacheKey(userId: number) {
  return createRedisKey(...REDIS_KEY_SCOPES.notifications.unreadCount, userId)
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

async function connectSharedRedis() {
  const redis = getRedis()
  await connectRedisClient(redis)
  return redis
}

function reportNotificationCacheFallback(error: unknown, action: string, metadata?: Record<string, unknown>) {
  logRuntimeError(error, {
    area: "notification-cache",
    action,
    message: "通知 Redis 缓存不可用，已回退到数据库路径",
    level: "warn",
    metadata,
  })
}

export async function getCachedUnreadNotificationCount(userId: number, loader: () => Promise<number>) {
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
    reportNotificationCacheFallback(error, "read-unread-count", { userId })
    return loader()
  }
}

export async function invalidateNotificationUserCache(userIds: number | number[]) {
  const normalizedUserIds = normalizeUserIds(userIds)
  if (!hasRedisUrl() || normalizedUserIds.length === 0) {
    return
  }

  try {
    const redis = await connectSharedRedis()
    await redis.del(...normalizedUserIds.map((userId) => buildUnreadCountCacheKey(userId)))
  } catch (error) {
    reportNotificationCacheFallback(error, "invalidate-user-cache", {
      userIds: normalizedUserIds,
    })
  }
}
