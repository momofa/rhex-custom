import { randomUUID } from "node:crypto"

import { findRssSourceById, type RssSourceAdminRecord } from "@/db/rss-harvest-queries"
import type { RssTriggerType } from "@/db/types"
import { connectRedisClient, createRedisKey, getRedis, hasRedisUrl } from "@/lib/redis"

type RssQueueStatusValue = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED"

export interface RssQueueRecord {
  id: string
  sourceId: string
  backgroundJobId: string | null
  triggerType: RssTriggerType
  status: RssQueueStatusValue
  priority: number
  scheduledAt: Date
  leaseExpiresAt: Date | null
  startedAt: Date | null
  finishedAt: Date | null
  attemptCount: number
  maxAttempts: number
  workerId: string | null
  errorMessage: string | null
  durationMs: number | null
  httpStatus: number | null
  contentType: string | null
  responseBytes: number | null
  fetchedCount: number
  insertedCount: number
  duplicateCount: number
  createdAt: Date
  updatedAt: Date
}

export interface RssQueueWithSourceRecord extends RssQueueRecord {
  source: RssSourceAdminRecord
}

export interface CreateRssQueueRecordInput {
  sourceId: string
  triggerType: RssTriggerType
  priority?: number
  scheduledAt?: Date
  maxAttempts?: number
}

export interface UpdateRssQueueRecordInput {
  backgroundJobId?: string | null
  triggerType?: RssTriggerType
  status?: RssQueueStatusValue
  priority?: number
  scheduledAt?: Date
  leaseExpiresAt?: Date | null
  startedAt?: Date | null
  finishedAt?: Date | null
  attemptCount?: number
  maxAttempts?: number
  workerId?: string | null
  errorMessage?: string | null
  durationMs?: number | null
  httpStatus?: number | null
  contentType?: string | null
  responseBytes?: number | null
  fetchedCount?: number
  insertedCount?: number
  duplicateCount?: number
  updatedAt?: Date
}

const RSS_QUEUE_ITEMS_KEY = createRedisKey("rss-harvest", "queue", "items")
const RSS_QUEUE_INDEX_KEY = createRedisKey("rss-harvest", "queue", "index")
const RSS_QUEUE_STATUS_MIGRATION_KEY = createRedisKey("rss-harvest", "queue", "migration", "byStatus-v1")
const RSS_QUEUE_EXECUTION_INDEX_KEY = createRedisKey("rss-harvest", "queue", "execution")
const RSS_QUEUE_EXECUTION_MIGRATION_KEY = createRedisKey("rss-harvest", "queue", "migration", "byExecution-v1")
const RSS_QUEUE_STATUSES = ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"] as const satisfies readonly RssQueueStatusValue[]
const RSS_QUEUE_RETENTION_SECONDS = Math.max(
  300,
  Number.parseInt(process.env.RSS_QUEUE_RETENTION_SECONDS?.trim() ?? "", 10) || 7 * 24 * 60 * 60,
)
const RSS_QUEUE_RETENTION_MS = RSS_QUEUE_RETENTION_SECONDS * 1_000
const REDIS_QUEUE_PRUNE_BATCH_SIZE = 200

type RedisQueueConnection = ReturnType<typeof getRedis>
type RssQueueRedisCommands = RedisQueueConnection & {
  rssQueueClaimPending: (
    itemsKey: string,
    pendingStatusKey: string,
    processingStatusKey: string,
    recordId: string,
    workerId: string,
    startedAt: string,
    score: string,
  ) => Promise<unknown>
}
type RedisQueueContext = {
  redis?: RedisQueueConnection
}
type GlobalRssQueueStore = {
  __bbsInMemoryRssQueueStore?: Map<string, RssQueueRecord>
}

const globalForRssQueueStore = globalThis as typeof globalThis & GlobalRssQueueStore

function getInMemoryRssQueueStore() {
  globalForRssQueueStore.__bbsInMemoryRssQueueStore ??= new Map()
  return globalForRssQueueStore.__bbsInMemoryRssQueueStore
}

function getSourceQueueIndexKey(sourceId: string) {
  return createRedisKey("rss-harvest", "queue", "source", sourceId)
}

function getStatusQueueIndexKey(status: RssQueueStatusValue) {
  return createRedisKey("rss-harvest", "queue", "byStatus", status)
}

function getSourceExecutionQueueIndexKey(sourceId: string) {
  return createRedisKey("rss-harvest", "queue", "sourceExecution", sourceId)
}

/**
 * 旧数据索引回填只在每次读路径上推进一个小批次，避免管理页加载时扫完整个队列。
 */
async function backfillRedisQueueIndexBatch(
  redis: RedisQueueConnection,
  markerKey: string,
  applyPairs: (pairs: Array<{ id: string; score: string }>, values: Array<string | null>) => Promise<void>,
) {
  const marker = await redis.get(markerKey).catch(() => null)
  if (marker === "1" || marker === "done") {
    return
  }

  const start = Math.max(0, Number.parseInt(marker ?? "0", 10) || 0)
  const raw = await redis.zrange(RSS_QUEUE_INDEX_KEY, start, start + REDIS_QUEUE_PRUNE_BATCH_SIZE - 1, "WITHSCORES").catch(() => [] as string[])
  if (raw.length === 0) {
    await redis.set(markerKey, "done").catch(() => null)
    return
  }

  const pairs: Array<{ id: string; score: string }> = []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    pairs.push({ id: raw[i]!, score: raw[i + 1]! })
  }
  if (pairs.length === 0) {
    await redis.set(markerKey, "done").catch(() => null)
    return
  }

  const values = await redis.hmget(RSS_QUEUE_ITEMS_KEY, ...pairs.map((p) => p.id))
  await applyPairs(pairs, values)

  if (pairs.length < REDIS_QUEUE_PRUNE_BATCH_SIZE) {
    await redis.set(markerKey, "done").catch(() => null)
  } else {
    await redis.set(markerKey, String(start + pairs.length)).catch(() => null)
  }
}

async function ensureStatusIndexesBackfilled(redis: RedisQueueConnection) {
  await backfillRedisQueueIndexBatch(redis, RSS_QUEUE_STATUS_MIGRATION_KEY, async (pairs, values) => {
    const multi = redis.multi()
    for (let i = 0; i < pairs.length; i += 1) {
      const rawValue = values[i]
      if (!rawValue) continue
      try {
        const record = JSON.parse(rawValue) as { status?: RssQueueStatusValue }
        if (record.status && (RSS_QUEUE_STATUSES as readonly string[]).includes(record.status)) {
          multi.zadd(getStatusQueueIndexKey(record.status), pairs[i]!.score, pairs[i]!.id)
        }
      } catch {
        // ignore corrupt row
      }
    }
    await multi.exec()
  })
}

async function ensureExecutionIndexesBackfilled(redis: RedisQueueConnection) {
  await backfillRedisQueueIndexBatch(redis, RSS_QUEUE_EXECUTION_MIGRATION_KEY, async (_pairs, values) => {
    const multi = redis.multi()
    for (const rawValue of values) {
      const record = parseRecord(rawValue)
      if (!record?.startedAt) continue
      const score = String(record.startedAt.getTime())
      multi.zadd(RSS_QUEUE_EXECUTION_INDEX_KEY, score, record.id)
      multi.zadd(getSourceExecutionQueueIndexKey(record.sourceId), score, record.id)
    }
    await multi.exec()
  })
}

function toDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function serializeRecord(record: RssQueueRecord) {
  return JSON.stringify({
    ...record,
    scheduledAt: record.scheduledAt.toISOString(),
    leaseExpiresAt: record.leaseExpiresAt?.toISOString() ?? null,
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  })
}

function cloneRecord(record: RssQueueRecord) {
  return {
    ...record,
    scheduledAt: new Date(record.scheduledAt),
    leaseExpiresAt: record.leaseExpiresAt ? new Date(record.leaseExpiresAt) : null,
    startedAt: record.startedAt ? new Date(record.startedAt) : null,
    finishedAt: record.finishedAt ? new Date(record.finishedAt) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  } satisfies RssQueueRecord
}

function parseRecord(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (
      typeof parsed.id !== "string"
      || typeof parsed.sourceId !== "string"
      || typeof parsed.triggerType !== "string"
      || typeof parsed.status !== "string"
      || typeof parsed.priority !== "number"
      || typeof parsed.scheduledAt !== "string"
      || typeof parsed.attemptCount !== "number"
      || typeof parsed.maxAttempts !== "number"
      || typeof parsed.createdAt !== "string"
      || typeof parsed.updatedAt !== "string"
    ) {
      return null
    }

    const scheduledAt = toDate(parsed.scheduledAt)
    const createdAt = toDate(parsed.createdAt)
    const updatedAt = toDate(parsed.updatedAt)
    if (!scheduledAt || !createdAt || !updatedAt) {
      return null
    }

    return {
      id: parsed.id,
      sourceId: parsed.sourceId,
      backgroundJobId: typeof parsed.backgroundJobId === "string" ? parsed.backgroundJobId : null,
      triggerType: parsed.triggerType as RssTriggerType,
      status: parsed.status as RssQueueStatusValue,
      priority: parsed.priority,
      scheduledAt,
      leaseExpiresAt: toDate(typeof parsed.leaseExpiresAt === "string" ? parsed.leaseExpiresAt : null),
      startedAt: toDate(typeof parsed.startedAt === "string" ? parsed.startedAt : null),
      finishedAt: toDate(typeof parsed.finishedAt === "string" ? parsed.finishedAt : null),
      attemptCount: parsed.attemptCount,
      maxAttempts: parsed.maxAttempts,
      workerId: typeof parsed.workerId === "string" ? parsed.workerId : null,
      errorMessage: typeof parsed.errorMessage === "string" ? parsed.errorMessage : null,
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : null,
      httpStatus: typeof parsed.httpStatus === "number" ? parsed.httpStatus : null,
      contentType: typeof parsed.contentType === "string" ? parsed.contentType : null,
      responseBytes: typeof parsed.responseBytes === "number" ? parsed.responseBytes : null,
      fetchedCount: typeof parsed.fetchedCount === "number" ? parsed.fetchedCount : 0,
      insertedCount: typeof parsed.insertedCount === "number" ? parsed.insertedCount : 0,
      duplicateCount: typeof parsed.duplicateCount === "number" ? parsed.duplicateCount : 0,
      createdAt,
      updatedAt,
    } satisfies RssQueueRecord
  } catch {
    return null
  }
}

function shouldPruneRecord(record: RssQueueRecord, nowMs: number) {
  return Boolean(
    record.finishedAt
    && nowMs - record.finishedAt.getTime() > RSS_QUEUE_RETENTION_MS,
  )
}

async function removeRedisRecord(redis: RedisQueueConnection, record: RssQueueRecord) {
  const multi = redis.multi()
    .hdel(RSS_QUEUE_ITEMS_KEY, record.id)
    .zrem(RSS_QUEUE_INDEX_KEY, record.id)
    .zrem(getSourceQueueIndexKey(record.sourceId), record.id)
    .zrem(RSS_QUEUE_EXECUTION_INDEX_KEY, record.id)
    .zrem(getSourceExecutionQueueIndexKey(record.sourceId), record.id)
  for (const status of RSS_QUEUE_STATUSES) {
    multi.zrem(getStatusQueueIndexKey(status), record.id)
  }
  await multi.exec()
}

async function withRedisQueueConnection<T>(
  _role: string,
  context: RedisQueueContext | undefined,
  handler: (redis: RedisQueueConnection) => Promise<T>,
) {
  const redis = context?.redis ?? getRedis()
  await connectRedisClient(redis)
  return handler(redis)
}

async function pruneRedisQueue(nowMs = Date.now(), context?: RedisQueueContext) {
  await withRedisQueueConnection("rss-harvest:queue-prune", context, async (redis) => {
    let start = 0
    let batchCount = 0

    while (batchCount < 1) {
      const ids = await redis.zrange(RSS_QUEUE_INDEX_KEY, start, start + REDIS_QUEUE_PRUNE_BATCH_SIZE - 1).catch(() => [])
      if (!Array.isArray(ids) || ids.length === 0) {
        return
      }

      const values = await redis.hmget(RSS_QUEUE_ITEMS_KEY, ...ids)
      let removedCount = 0
      for (let index = 0; index < ids.length; index += 1) {
        const record = parseRecord(values[index])
        if (!record || shouldPruneRecord(record, nowMs)) {
          removedCount += 1
          if (record) {
            await removeRedisRecord(redis, record)
          } else {
            const orphanId = ids[index] ?? ""
            const multi = redis.multi()
              .hdel(RSS_QUEUE_ITEMS_KEY, orphanId)
              .zrem(RSS_QUEUE_INDEX_KEY, orphanId)
              .zrem(RSS_QUEUE_EXECUTION_INDEX_KEY, orphanId)
            for (const status of RSS_QUEUE_STATUSES) {
              multi.zrem(getStatusQueueIndexKey(status), orphanId)
            }
            await multi.exec()
          }
        }
      }

      if (ids.length < REDIS_QUEUE_PRUNE_BATCH_SIZE) {
        return
      }
      start += Math.max(0, ids.length - removedCount)
      batchCount += 1
    }
  })
}

async function pruneQueueStore(context?: RedisQueueContext) {
  if (hasRedisUrl()) {
    await pruneRedisQueue(Date.now(), context)
    return
  }

  const store = getInMemoryRssQueueStore()
  const nowMs = Date.now()
  for (const [id, record] of store.entries()) {
    if (shouldPruneRecord(record, nowMs)) {
      store.delete(id)
    }
  }
}

async function readRedisRecordsByIds(ids: string[], context?: RedisQueueContext) {
  if (ids.length === 0) {
    return [] satisfies RssQueueRecord[]
  }

  return withRedisQueueConnection("rss-harvest:queue-read", context, async (redis) => {
    const values = await redis.hmget(RSS_QUEUE_ITEMS_KEY, ...ids)
    return values
      .map((value) => parseRecord(value))
      .filter((item): item is RssQueueRecord => Boolean(item))
  })
}

async function readRedisSortedIds(
  key: string,
  options: {
    role: string
    start: number
    stop: number
    reverse?: boolean
  },
  context?: RedisQueueContext,
) {
  return withRedisQueueConnection(options.role, context, async (redis) => {
    const ids = options.reverse
      ? await redis.zrevrange(key, options.start, options.stop).catch(() => [])
      : await redis.zrange(key, options.start, options.stop).catch(() => [])

    return Array.isArray(ids) ? ids.map(String) : []
  })
}

async function readQueueRecord(id: string, context?: RedisQueueContext) {
  await pruneQueueStore(context)
  if (!hasRedisUrl()) {
    const record = getInMemoryRssQueueStore().get(id)
    return record ? cloneRecord(record) : null
  }

  return withRedisQueueConnection("rss-harvest:queue-read-one", context, async (redis) => {
    const value = await redis.hget(RSS_QUEUE_ITEMS_KEY, id)
    return parseRecord(value)
  })
}

async function persistQueueRecord(record: RssQueueRecord, context?: RedisQueueContext) {
  if (!hasRedisUrl()) {
    getInMemoryRssQueueStore().set(record.id, cloneRecord(record))
    return
  }

  await withRedisQueueConnection("rss-harvest:queue-write", context, async (redis) => {
    const score = record.createdAt.getTime()
    const multi = redis.multi()
      .hset(RSS_QUEUE_ITEMS_KEY, record.id, serializeRecord(record))
      .zadd(RSS_QUEUE_INDEX_KEY, String(score), record.id)
      .zadd(getSourceQueueIndexKey(record.sourceId), String(score), record.id)
    if (record.startedAt) {
      const executionScore = String(record.startedAt.getTime())
      multi.zadd(RSS_QUEUE_EXECUTION_INDEX_KEY, executionScore, record.id)
      multi.zadd(getSourceExecutionQueueIndexKey(record.sourceId), executionScore, record.id)
    } else {
      multi.zrem(RSS_QUEUE_EXECUTION_INDEX_KEY, record.id)
      multi.zrem(getSourceExecutionQueueIndexKey(record.sourceId), record.id)
    }
    for (const status of RSS_QUEUE_STATUSES) {
      if (status === record.status) {
        multi.zadd(getStatusQueueIndexKey(status), String(score), record.id)
      } else {
        multi.zrem(getStatusQueueIndexKey(status), record.id)
      }
    }
    await multi.exec()
  })
}

function applyPatch(record: RssQueueRecord, patch: UpdateRssQueueRecordInput) {
  return {
    ...record,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date(),
  } satisfies RssQueueRecord
}

async function claimPendingRedisQueueRecord(id: string, input: {
  workerId: string
  startedAt: Date
}, context?: RedisQueueContext) {
  return withRedisQueueConnection("rss-harvest:queue-claim", context, async (redis) => {
    const nextValue = await (redis as RssQueueRedisCommands).rssQueueClaimPending(
      RSS_QUEUE_ITEMS_KEY,
      getStatusQueueIndexKey("PENDING"),
      getStatusQueueIndexKey("PROCESSING"),
      id,
      input.workerId,
      input.startedAt.toISOString(),
      String(input.startedAt.getTime()),
    )

    return typeof nextValue === "string" ? parseRecord(nextValue) : null
  })
}

async function claimPendingInMemoryQueueRecord(id: string, input: {
  workerId: string
  startedAt: Date
}) {
  const current = getInMemoryRssQueueStore().get(id)
  if (!current || current.status !== "PENDING") {
    return null
  }

  const nextRecord = applyPatch(current, {
    backgroundJobId: null,
    status: "PROCESSING",
    startedAt: input.startedAt,
    attemptCount: current.attemptCount + 1,
    workerId: input.workerId,
    leaseExpiresAt: null,
    updatedAt: input.startedAt,
  })
  await persistQueueRecord(nextRecord)
  return cloneRecord(nextRecord)
}

function listInMemoryQueueItems(filter?: (record: RssQueueRecord) => boolean) {
  return [...getInMemoryRssQueueStore().values()]
    .filter((record) => filter ? filter(record) : true)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map(cloneRecord)
}

async function resolveQueueWithSource(record: RssQueueRecord | null) {
  if (!record) {
    return null
  }

  const source = await findRssSourceById(record.sourceId)
  if (!source) {
    return null
  }

  return {
    ...record,
    source,
  } satisfies RssQueueWithSourceRecord
}

export async function createRssQueueRecord(input: CreateRssQueueRecordInput) {
  const now = new Date()
  const record: RssQueueRecord = {
    id: randomUUID(),
    sourceId: input.sourceId,
    backgroundJobId: null,
    triggerType: input.triggerType,
    status: "PENDING",
    priority: input.priority ?? 0,
    scheduledAt: input.scheduledAt ?? now,
    leaseExpiresAt: null,
    startedAt: null,
    finishedAt: null,
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 3,
    workerId: null,
    errorMessage: null,
    durationMs: null,
    httpStatus: null,
    contentType: null,
    responseBytes: null,
    fetchedCount: 0,
    insertedCount: 0,
    duplicateCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  await persistQueueRecord(record)
  return record
}

export async function findRssQueueWithSourceById(id: string) {
  return resolveQueueWithSource(await readQueueRecord(id))
}

export async function updateRssQueueRecord(id: string, patch: UpdateRssQueueRecordInput) {
  const current = await readQueueRecord(id)
  if (!current) {
    throw new Error(`RSS queue record not found: ${id}`)
  }

  const nextRecord = applyPatch(current, patch)
  await persistQueueRecord(nextRecord)
  return nextRecord
}

export async function claimPendingRssQueueRecord(id: string, input: {
  workerId: string
  startedAt: Date
}) {
  await pruneQueueStore()
  if (!hasRedisUrl()) {
    return claimPendingInMemoryQueueRecord(id, input)
  }

  return claimPendingRedisQueueRecord(id, input)
}

export async function countRssQueueSummary() {
  if (!hasRedisUrl()) {
    const items = listInMemoryQueueItems()
    const pending = items.filter((item) => item.status === "PENDING").length
    const processing = items.filter((item) => item.status === "PROCESSING").length
    const failed = items.filter((item) => item.status === "FAILED").length
    return [pending, processing, failed] as const
  }

  return withRedisQueueConnection("rss-harvest:queue-summary", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    await ensureStatusIndexesBackfilled(redis)
    const [pending, processing, failed] = await Promise.all([
      redis.zcard(getStatusQueueIndexKey("PENDING")).catch(() => 0),
      redis.zcard(getStatusQueueIndexKey("PROCESSING")).catch(() => 0),
      redis.zcard(getStatusQueueIndexKey("FAILED")).catch(() => 0),
    ])
    return [Number(pending) || 0, Number(processing) || 0, Number(failed) || 0] as const
  })
}

export async function countActiveQueueItemsForSource(sourceId: string) {
  const items = await listRssQueueItemsBySource(sourceId)
  return items.filter((item) => item.status === "PENDING" || item.status === "PROCESSING").length
}

export async function cancelPendingQueueItemsForSource(sourceId: string) {
  const items = await listRssQueueItemsBySource(sourceId)
  let count = 0

  for (const item of items) {
    if (item.status !== "PENDING") {
      continue
    }

    await updateRssQueueRecord(item.id, {
      backgroundJobId: null,
      status: "CANCELLED",
      finishedAt: new Date(),
      errorMessage: "任务已由管理员停止",
      leaseExpiresAt: null,
      workerId: null,
    })
    count += 1
  }

  return { count }
}

export async function clearRssQueueHistoryBySource(sourceId: string) {
  const items = await listRssQueueItemsBySource(sourceId)
  const finishedItems = items.filter((item) => item.finishedAt)

  if (finishedItems.length === 0) {
    return { count: 0 }
  }

  if (!hasRedisUrl()) {
    const store = getInMemoryRssQueueStore()
    for (const item of finishedItems) {
      store.delete(item.id)
    }
    return { count: finishedItems.length }
  }

  await withRedisQueueConnection("rss-harvest:queue-clear-source", undefined, async (redis) => {
    const multi = redis.multi()
    for (const item of finishedItems) {
      multi.hdel(RSS_QUEUE_ITEMS_KEY, item.id)
      multi.zrem(RSS_QUEUE_INDEX_KEY, item.id)
      multi.zrem(getSourceQueueIndexKey(sourceId), item.id)
      multi.zrem(RSS_QUEUE_EXECUTION_INDEX_KEY, item.id)
      multi.zrem(getSourceExecutionQueueIndexKey(sourceId), item.id)
      for (const status of RSS_QUEUE_STATUSES) {
        multi.zrem(getStatusQueueIndexKey(status), item.id)
      }
    }
    await multi.exec()
  })

  return { count: finishedItems.length }
}

export async function countRssQueueItemsBySource(sourceId: string) {
  if (!hasRedisUrl()) {
    return listInMemoryQueueItems((item) => item.sourceId === sourceId).length
  }

  return withRedisQueueConnection("rss-harvest:queue-count-source", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    return Number(await redis.zcard(getSourceQueueIndexKey(sourceId)).catch(() => 0))
  })
}

export async function listRssQueueItemsBySource(sourceId: string, limit = 20) {
  return listRssQueueItemsPageBySource(sourceId, 0, limit)
}

export async function listRssQueueItemsPageBySource(sourceId: string, skip: number, take: number) {
  if (!hasRedisUrl()) {
    return listInMemoryQueueItems((item) => item.sourceId === sourceId).slice(skip, skip + take)
  }

  return withRedisQueueConnection("rss-harvest:queue-list-source", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    const ids = await readRedisSortedIds(getSourceQueueIndexKey(sourceId), {
      role: "rss-harvest:queue-list-source-read-ids",
      start: skip,
      stop: skip + take - 1,
      reverse: true,
    }, { redis })

    return readRedisRecordsByIds(ids, { redis })
  })
}

function isExecutionQueueRecord(item: RssQueueRecord) {
  return Boolean(item.startedAt)
}

function sortExecutionRecordsDesc(left: RssQueueRecord, right: RssQueueRecord) {
  const leftTime = left.startedAt?.getTime() ?? left.createdAt.getTime()
  const rightTime = right.startedAt?.getTime() ?? right.createdAt.getTime()
  return rightTime - leftTime
}

async function listAllQueueItems() {
  if (!hasRedisUrl()) {
    await pruneQueueStore()
    return listInMemoryQueueItems()
  }

  return withRedisQueueConnection("rss-harvest:queue-list-all", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    const ids = await readRedisSortedIds(RSS_QUEUE_INDEX_KEY, {
      role: "rss-harvest:queue-list-all-read-ids",
      start: 0,
      stop: -1,
      reverse: true,
    }, { redis })
    return readRedisRecordsByIds(ids, { redis })
  })
}

async function listAllQueueItemsBySource(sourceId: string) {
  if (!hasRedisUrl()) {
    await pruneQueueStore()
    return listInMemoryQueueItems((item) => item.sourceId === sourceId)
  }

  return withRedisQueueConnection("rss-harvest:queue-list-all-source", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    const ids = await readRedisSortedIds(getSourceQueueIndexKey(sourceId), {
      role: "rss-harvest:queue-list-all-source-read-ids",
      start: 0,
      stop: -1,
      reverse: true,
    }, { redis })
    return readRedisRecordsByIds(ids, { redis })
  })
}

export async function countRssExecutionItems() {
  if (!hasRedisUrl()) {
    return listInMemoryQueueItems(isExecutionQueueRecord).length
  }

  return withRedisQueueConnection("rss-harvest:queue-count-execution", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    await ensureExecutionIndexesBackfilled(redis)
    return Number(await redis.zcard(RSS_QUEUE_EXECUTION_INDEX_KEY).catch(() => 0))
  })
}

export async function listAllRssQueueItems() {
  return listAllQueueItems()
}

export async function listAllRssQueueItemsBySource(sourceId: string) {
  return listAllQueueItemsBySource(sourceId)
}

export async function listRssExecutionItemsPage(skip: number, take: number) {
  if (!hasRedisUrl()) {
    return listInMemoryQueueItems(isExecutionQueueRecord)
      .sort(sortExecutionRecordsDesc)
      .slice(skip, skip + take)
  }

  return withRedisQueueConnection("rss-harvest:queue-list-execution", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    await ensureExecutionIndexesBackfilled(redis)
    const ids = await readRedisSortedIds(RSS_QUEUE_EXECUTION_INDEX_KEY, {
      role: "rss-harvest:queue-list-execution-read-ids",
      start: skip,
      stop: skip + take - 1,
      reverse: true,
    }, { redis })
    return readRedisRecordsByIds(ids, { redis })
  })
}

export async function listCompletedRssQueueIds() {
  const items = await listAllQueueItems()
  return items
    .filter((item) => Boolean(item.finishedAt))
    .map((item) => ({ id: item.id }))
}

export async function clearRssQueueHistory() {
  const finishedItems = (await listAllQueueItems()).filter((item) => Boolean(item.finishedAt))

  if (finishedItems.length === 0) {
    return { count: 0 }
  }

  if (!hasRedisUrl()) {
    const store = getInMemoryRssQueueStore()
    for (const item of finishedItems) {
      store.delete(item.id)
    }
    return { count: finishedItems.length }
  }

  await withRedisQueueConnection("rss-harvest:queue-clear-all", undefined, async (redis) => {
    const multi = redis.multi()
    for (const item of finishedItems) {
      multi.hdel(RSS_QUEUE_ITEMS_KEY, item.id)
      multi.zrem(RSS_QUEUE_INDEX_KEY, item.id)
      multi.zrem(getSourceQueueIndexKey(item.sourceId), item.id)
      multi.zrem(RSS_QUEUE_EXECUTION_INDEX_KEY, item.id)
      multi.zrem(getSourceExecutionQueueIndexKey(item.sourceId), item.id)
      for (const status of RSS_QUEUE_STATUSES) {
        multi.zrem(getStatusQueueIndexKey(status), item.id)
      }
    }
    await multi.exec()
  })

  return { count: finishedItems.length }
}

export async function countRssExecutionItemsBySource(sourceId: string) {
  if (!hasRedisUrl()) {
    return listInMemoryQueueItems((item) => item.sourceId === sourceId && isExecutionQueueRecord(item)).length
  }

  return withRedisQueueConnection("rss-harvest:queue-count-execution-source", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    await ensureExecutionIndexesBackfilled(redis)
    return Number(await redis.zcard(getSourceExecutionQueueIndexKey(sourceId)).catch(() => 0))
  })
}

export async function listRssExecutionItemsBySource(sourceId: string, limit = 20) {
  return listRssExecutionItemsPageBySource(sourceId, 0, limit)
}

export async function listRssExecutionItemsPageBySource(sourceId: string, skip: number, take: number) {
  if (!hasRedisUrl()) {
    return listInMemoryQueueItems((item) => item.sourceId === sourceId && isExecutionQueueRecord(item))
      .sort(sortExecutionRecordsDesc)
      .slice(skip, skip + take)
  }

  return withRedisQueueConnection("rss-harvest:queue-list-execution-source", undefined, async (redis) => {
    await pruneQueueStore({ redis })
    await ensureExecutionIndexesBackfilled(redis)
    const ids = await readRedisSortedIds(getSourceExecutionQueueIndexKey(sourceId), {
      role: "rss-harvest:queue-list-execution-source-read-ids",
      start: skip,
      stop: skip + take - 1,
      reverse: true,
    }, { redis })
    return readRedisRecordsByIds(ids, { redis })
  })
}

export async function listCompletedRssQueueIdsBySource(sourceId: string) {
  const items = await listAllQueueItemsBySource(sourceId)
  return items
    .filter((item) => Boolean(item.finishedAt))
    .map((item) => ({ id: item.id }))
}
