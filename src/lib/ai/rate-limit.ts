import "server-only"

import { prisma } from "@/db/client"
import { connectRedisClient, createRedisKey, getRedis } from "@/lib/redis"

/**
 * 能力 3：日调用上限
 *
 * 使用方式（service.ts runAiTask 入口）：
 *   const limit = await resolveDailyLimit(appKey)
 *   await checkAndIncrementDaily(appKey, limit)
 *
 * - limit <= 0 视为不限，直接 no-op；
 * - 优先 Redis INCR `{prefix}:ai:daily:{appKey}:{YYYY-MM-DD}`，首次写入时 EXPIRE 86400s；
 * - Redis 不可用或连接失败 → 降级 prisma.aiUsageDaily upsert + select count 判断；
 * - 超出则抛 AiRateLimitError，调用方（worker）据此直接标失败、不重试。
 */

export class AiRateLimitError extends Error {
  readonly appKey: string
  readonly limit: number
  readonly count: number

  constructor(appKey: string, limit: number, count: number, message?: string) {
    super(message ?? `Daily AI call limit reached for ${appKey} (${count}/${limit})`)
    this.name = "AiRateLimitError"
    this.appKey = appKey
    this.limit = limit
    this.count = count
  }
}

type AiRateLimitRedisCommands = ReturnType<typeof getRedis> & {
  aiDailyIncrWithExpire: (key: string, expireSeconds: string) => Promise<number>
}

/** 返回 UTC 当日 YYYY-MM-DD */
function todayStr(d: Date = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** 返回 UTC 当日 00:00 的 Date（aiUsageDaily.day 使用 @db.Date） */
function todayDate(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function redisKeyFor(appKey: string, day: string): string {
  return createRedisKey("ai", "daily", appKey, day)
}

async function incrementViaRedis(appKey: string, day: string): Promise<number | null> {
  try {
    const client = getRedis()
    await connectRedisClient(client)
    const key = redisKeyFor(appKey, day)
    return Number(await (client as AiRateLimitRedisCommands).aiDailyIncrWithExpire(key, String(60 * 60 * 48)))
  } catch {
    return null
  }
}

async function incrementViaPrisma(appKey: string, day: Date): Promise<number> {
  const row = await prisma.aiUsageDaily.upsert({
    where: { appKey_day: { appKey, day } },
    create: { appKey, day, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  })
  return row.count
}

/**
 * 原子自增今日调用数，超 limit 抛 AiRateLimitError。
 * limit <= 0 视为不限，直接返回。
 */
export async function checkAndIncrementDaily(appKey: string, limit: number): Promise<void> {
  if (!Number.isFinite(limit) || limit <= 0) return

  const day = todayStr()
  const redisCount = await incrementViaRedis(appKey, day)

  let count: number
  if (typeof redisCount === "number") {
    count = redisCount
  } else {
    count = await incrementViaPrisma(appKey, todayDate())
  }

  if (count > limit) {
    throw new AiRateLimitError(appKey, limit, count)
  }
}

export type DailyUsageItem = {
  appKey: string
  day: string
  count: number
  source: "redis" | "prisma"
}

/** 读取今日所有 appKey 的用量（Redis 找不到则回落 prisma 行）。admin 页展示用。 */
export async function getTodayUsage(appKeys: string[]): Promise<DailyUsageItem[]> {
  const day = todayStr()
  const out: DailyUsageItem[] = []

  let redisOk = true
  let client: ReturnType<typeof getRedis> | null = null
  try {
    client = getRedis()
    await connectRedisClient(client)
  } catch {
    redisOk = false
    client = null
  }

  const redisValues = redisOk && client
    ? await client.mget(...appKeys.map((appKey) => redisKeyFor(appKey, day))).catch(() => null)
    : null

  for (const [index, appKey] of appKeys.entries()) {
    let count = 0
    let source: "redis" | "prisma" = "prisma"
    const redisValue = Array.isArray(redisValues) ? redisValues[index] : null
    if (redisValue !== null && typeof redisValue !== "undefined") {
      count = Number(redisValue) || 0
      source = "redis"
      out.push({ appKey, day, count, source })
      continue
    }
    const row = await prisma.aiUsageDaily.findUnique({
      where: { appKey_day: { appKey, day: todayDate() } },
      select: { count: true },
    })
    count = row?.count ?? 0
    out.push({ appKey, day, count, source })
  }
  return out
}

/** 重置今日某 appKey 用量（Redis DEL + prisma count=0）。返回受影响来源。 */
export async function resetTodayUsage(appKey: string): Promise<{ redisDeleted: boolean; prismaUpdated: boolean }> {
  const day = todayStr()
  let redisDeleted = false
  try {
    const client = getRedis()
    await connectRedisClient(client)
    const n = await client.del(redisKeyFor(appKey, day))
    redisDeleted = n > 0
  } catch {
    redisDeleted = false
  }

  let prismaUpdated = false
  try {
    const res = await prisma.aiUsageDaily.updateMany({
      where: { appKey, day: todayDate() },
      data: { count: 0 },
    })
    prismaUpdated = res.count > 0
  } catch {
    prismaUpdated = false
  }

  return { redisDeleted, prismaUpdated }
}
