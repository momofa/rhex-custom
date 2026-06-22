import { randomUUID } from "node:crypto"

import type { Prisma, RssLogLevel } from "@/db/types"
import { serializeDateTime } from "@/lib/formatters"
import { connectRedisClient, createRedisKey, getRedis } from "@/lib/redis"
import {
  getLogStoreMaxEntries,
  pruneCappedLog,
  queueCappedLogPrune,
} from "@/lib/redis-capped-log"


export interface RssExecutionLogRecord {
  id: string
  runId: string
  sourceId: string
  sourceName: string
  level: RssLogLevel
  stage: string
  message: string
  detailText: string | null
  createdAt: string
}

export interface RssExecutionLogPage {
  items: RssExecutionLogRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

const RSS_EXECUTION_LOG_KEY = createRedisKey("rss-harvest", "execution-log")
const RSS_EXECUTION_LOG_RETENTION_SECONDS = Math.max(
  60,
  Number.parseInt(process.env.RSS_LOG_RETENTION_SECONDS?.trim() ?? "", 10) || 3 * 24 * 60 * 60,
)
const RSS_EXECUTION_LOG_RETENTION_MS = RSS_EXECUTION_LOG_RETENTION_SECONDS * 1_000
const RSS_EXECUTION_LOG_KEY_EXPIRE_SECONDS = RSS_EXECUTION_LOG_RETENTION_SECONDS * 2
const REDIS_LOG_SCAN_PAGE_SIZE = 200

function normalizeRequestedPage(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.trunc(value))
}

function normalizeRequestedPageSize(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 10
  }

  return Math.max(1, Math.min(100, Math.trunc(value)))
}


function parseExecutionLog(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<RssExecutionLogRecord>

    if (
      !parsed
      || typeof parsed !== "object"
      || typeof parsed.id !== "string"
      || typeof parsed.runId !== "string"
      || typeof parsed.sourceId !== "string"
      || typeof parsed.sourceName !== "string"
      || typeof parsed.level !== "string"
      || typeof parsed.stage !== "string"
      || typeof parsed.message !== "string"
      || typeof parsed.createdAt !== "string"
    ) {
      return null
    }

    return {
      id: parsed.id,
      runId: parsed.runId,
      sourceId: parsed.sourceId,
      sourceName: parsed.sourceName,
      level: parsed.level as RssLogLevel,
      stage: parsed.stage,
      message: parsed.message,
      detailText: typeof parsed.detailText === "string" ? parsed.detailText : null,
      createdAt: parsed.createdAt,
    } satisfies RssExecutionLogRecord
  } catch {
    return null
  }
}

async function scanRssExecutionLogMembers(
  redis: ReturnType<typeof getRedis>,
  options: {
    reverse?: boolean
    visit: (member: string) => boolean | Promise<boolean>
  },
) {
  let start = 0

  while (true) {
    const stop = start + REDIS_LOG_SCAN_PAGE_SIZE - 1
    const encodedItems = options.reverse
      ? await redis.zrevrange(RSS_EXECUTION_LOG_KEY, start, stop).catch(() => [])
      : await redis.zrange(RSS_EXECUTION_LOG_KEY, start, stop).catch(() => [])

    if (!Array.isArray(encodedItems) || encodedItems.length === 0) {
      return
    }

    for (const item of encodedItems) {
      if (await options.visit(String(item))) {
        return
      }
    }

    if (encodedItems.length < REDIS_LOG_SCAN_PAGE_SIZE) {
      return
    }
    start += REDIS_LOG_SCAN_PAGE_SIZE
  }
}

function stringifyDetailText(detailJson: unknown) {
  if (typeof detailJson === "undefined" || detailJson === null) {
    return null
  }

  try {
    return JSON.stringify(detailJson)
  } catch {
    return null
  }
}

async function pruneExecutionLogsWithRedis(redis: ReturnType<typeof getRedis>, nowMs: number) {
  return pruneCappedLog(redis, RSS_EXECUTION_LOG_KEY, {
    nowMs,
    retentionMs: RSS_EXECUTION_LOG_RETENTION_MS,
    maxEntries: getLogStoreMaxEntries(),
    expireSeconds: RSS_EXECUTION_LOG_KEY_EXPIRE_SECONDS,
  })
}

export async function persistRssExecutionLogBatch(items: Array<{
  runId: string
  sourceId: string
  sourceName: string
  level: RssLogLevel
  stage: string
  message: string
  detailJson?: Prisma.InputJsonValue | null
}>) {
  if (items.length === 0) {
    return
  }

  const redis = getRedis()
  const occurredAtMs = Date.now()

  try {
    await connectRedisClient(redis)
    const multi = redis.multi()

    for (const [index, item] of items.entries()) {
      const record: RssExecutionLogRecord = {
        id: randomUUID(),
        runId: item.runId,
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        level: item.level,
        stage: item.stage,
        message: item.message,
        detailText: stringifyDetailText(item.detailJson),
        createdAt: new Date(occurredAtMs + index).toISOString(),
      }

      multi.zadd(
        RSS_EXECUTION_LOG_KEY,
        String(occurredAtMs + index),
        JSON.stringify(record),
      )
    }

    queueCappedLogPrune(multi, RSS_EXECUTION_LOG_KEY, {
      nowMs: occurredAtMs,
      retentionMs: RSS_EXECUTION_LOG_RETENTION_MS,
      maxEntries: getLogStoreMaxEntries(),
      expireSeconds: RSS_EXECUTION_LOG_KEY_EXPIRE_SECONDS,
    })
    await multi.exec()
  } catch (error) {
    console.error("[rss-log-store] persist failed", error)
  }
}

export async function getRssExecutionLogPage(options?: {
  page?: number
  pageSize?: number
}) {
  const requestedPage = normalizeRequestedPage(options?.page)
  const pageSize = normalizeRequestedPageSize(options?.pageSize)
  const redis = getRedis()

  await connectRedisClient(redis)
  await pruneExecutionLogsWithRedis(redis, Date.now())
  const total = Number(await redis.zcard(RSS_EXECUTION_LOG_KEY).catch(() => 0))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const start = Math.max(0, (page - 1) * pageSize)
  const stop = start + pageSize - 1
  const encodedItems = await redis.zrevrange(RSS_EXECUTION_LOG_KEY, start, stop).catch(() => [])

  const items = Array.isArray(encodedItems)
    ? encodedItems
      .map((item) => parseExecutionLog(String(item)))
      .filter((item): item is RssExecutionLogRecord => Boolean(item))
    : []

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  } satisfies RssExecutionLogPage
}

export async function clearRssExecutionLogs() {
  const redis = getRedis()

  await connectRedisClient(redis)
  const total = Number(await redis.zcard(RSS_EXECUTION_LOG_KEY).catch(() => 0))
  await redis.del(RSS_EXECUTION_LOG_KEY)
  return { count: total }
}

export async function deleteRssExecutionLogsByRunIds(runIds: string[]) {
  if (runIds.length === 0) {
    return { count: 0 }
  }

  const targetIds = new Set(runIds)
  const redis = getRedis()

  await connectRedisClient(redis)
  const matchedMembers: string[] = []
  await scanRssExecutionLogMembers(redis, {
    visit: (member) => {
      const parsed = parseExecutionLog(member)
      if (parsed && targetIds.has(parsed.runId)) {
        matchedMembers.push(member)
      }
      return false
    },
  })

  if (matchedMembers.length === 0) {
    return { count: 0 }
  }

  const removed = await redis.zrem(RSS_EXECUTION_LOG_KEY, ...matchedMembers)
  return { count: Number(removed) }
}

export async function findRssExecutionLogsForRunIds(runIds: string[]) {
  if (runIds.length === 0) {
    return [] satisfies RssExecutionLogRecord[]
  }

  const targetIds = new Set(runIds)
  const redis = getRedis()

  await connectRedisClient(redis)
  await pruneExecutionLogsWithRedis(redis, Date.now())
  const matchedItems: RssExecutionLogRecord[] = []
  await scanRssExecutionLogMembers(redis, {
    reverse: true,
    visit: (member) => {
      const item = parseExecutionLog(member)
      if (item && targetIds.has(item.runId)) {
        matchedItems.push(item)
      }
      return false
    },
  })

  return matchedItems
}

export function serializeRssExecutionLogDateTime(input: string) {
  return serializeDateTime(input) ?? input
}
