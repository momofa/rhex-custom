import {
  getBackgroundJobConsumerGroupName,
  getBackgroundJobDeadLetterKey,
  getBackgroundJobDelayedSetKey,
  getBackgroundJobStreamKey,
} from "@/lib/background-job-redis"
import {
  getInMemoryBackgroundJobDeadLetters,
  parseBackgroundJobEnvelopeString,
  type BackgroundJobDeadLetterRecord,
  type BackgroundJobEnvelope,
} from "@/lib/background-jobs"
import { connectRedisClient, getRedis, hasRedisUrl } from "@/lib/redis"

import {
  buildPagination,
  normalizeRequestedWorkerLogPage,
  type PaginationInfo,
} from "./format-helpers"
import {
  parseRedisClientListEntry,
  parseRedisDeadLetter,
  parseRedisZRangeWithScores,
  resolveBackgroundJobConnectionKind,
  type BackgroundJobConnectionKind,
} from "./redis-parsers"

export interface RedisQueueSnapshot {
  streamLength: number | null
  pendingCount: number | null
  delayedCount: number | null
  delayedPagination: PaginationInfo
  deadLetterPagination: PaginationInfo
  deadLetterCount: number
  liveWorkers: Array<{
    name: string
    processRole: string
    pid: string
    connectionRole: string
    connectionKind: BackgroundJobConnectionKind
    address: string | null
    idleSeconds: number | null
  }>
  delayedJobs: Array<{
    scoreMs: number
    job: BackgroundJobEnvelope
  }>
  deadLetters: BackgroundJobDeadLetterRecord[]
}

async function readRedisQueueSnapshot(options?: {
  delayedPage?: number
  delayedPageSize?: number
  deadLetterPage?: number
  deadLetterPageSize?: number
}): Promise<RedisQueueSnapshot> {
  const redis = getRedis()
  const requestedDelayedPage = normalizeRequestedWorkerLogPage(options?.delayedPage)
  const delayedPageSize = Math.max(1, Math.trunc(options?.delayedPageSize ?? 10))
  const requestedDeadLetterPage = normalizeRequestedWorkerLogPage(options?.deadLetterPage)
  const deadLetterPageSize = Math.max(1, Math.trunc(options?.deadLetterPageSize ?? 10))

  await connectRedisClient(redis)

  const [streamLengthRaw, delayedCountRaw, deadLetterCountRaw, clientListRaw] = await Promise.all([
    redis.xlen(getBackgroundJobStreamKey()).catch(() => null),
    redis.zcard(getBackgroundJobDelayedSetKey()).catch(() => null),
    redis.llen(getBackgroundJobDeadLetterKey()).catch(() => 0),
    redis.client("LIST").catch(() => ""),
  ])

  const pendingSummaryRaw = await redis.call(
    "XPENDING",
    getBackgroundJobStreamKey(),
    getBackgroundJobConsumerGroupName(),
  ).catch(() => null)

  const pendingCount = Array.isArray(pendingSummaryRaw)
    ? Number(pendingSummaryRaw[0] ?? 0)
    : null

  const liveWorkers = String(clientListRaw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseRedisClientListEntry)
    .map((fields) => {
      const name = fields.get("name") ?? ""
      const parts = name.split(":")
      const processRole = parts[1] ?? "unknown"
      const pid = parts[2] ?? "-"
      const connectionRole = parts.slice(3).join(":")

      return {
        name,
        processRole,
        pid,
        connectionRole,
        connectionKind: resolveBackgroundJobConnectionKind(connectionRole),
        address: fields.get("addr") ?? null,
        idleSeconds: fields.get("idle") ? Number(fields.get("idle")) : null,
      }
    })
    .filter((item) => item.connectionRole.startsWith("background-job:") && item.connectionRole !== "background-job:admin")
    .sort((left, right) => left.name.localeCompare(right.name))

  const delayedTotal = delayedCountRaw === null ? 0 : Number(delayedCountRaw)
  const delayedPagination = buildPagination(delayedTotal, requestedDelayedPage, delayedPageSize)
  const delayedStart = Math.max(0, (delayedPagination.page - 1) * delayedPagination.pageSize)
  const delayedStop = delayedStart + delayedPagination.pageSize - 1
  const delayedItemsRaw = await redis.zrange(getBackgroundJobDelayedSetKey(), delayedStart, delayedStop, "WITHSCORES").catch(() => [])
  const delayedJobs = parseRedisZRangeWithScores(delayedItemsRaw)
    .map((item) => {
      const job = parseBackgroundJobEnvelopeString(item.member)
      return job ? { scoreMs: item.scoreMs, job } : null
    })
    .filter((item): item is RedisQueueSnapshot["delayedJobs"][number] => Boolean(item))
  const deadLetterTotal = Number(deadLetterCountRaw ?? 0)
  const deadLetterPagination = buildPagination(deadLetterTotal, requestedDeadLetterPage, deadLetterPageSize)
  const deadLetterStart = Math.max(0, (deadLetterPagination.page - 1) * deadLetterPagination.pageSize)
  const deadLetterStop = deadLetterStart + deadLetterPagination.pageSize - 1
  const deadLetterItems = await redis.lrange(getBackgroundJobDeadLetterKey(), deadLetterStart, deadLetterStop).catch(() => [])

  return {
    streamLength: streamLengthRaw === null ? null : Number(streamLengthRaw),
    pendingCount,
    delayedCount: delayedCountRaw === null ? null : delayedTotal,
    delayedPagination,
    deadLetterPagination,
    deadLetterCount: deadLetterTotal,
    liveWorkers,
    delayedJobs,
    deadLetters: Array.isArray(deadLetterItems)
      ? deadLetterItems
        .map((item) => parseRedisDeadLetter(String(item)))
        .filter((item): item is BackgroundJobDeadLetterRecord => Boolean(item))
      : [],
  }
}

export async function readDeadLetterSnapshot(options?: {
  delayedPage?: number
  delayedPageSize?: number
  deadLetterPage?: number
  deadLetterPageSize?: number
}): Promise<RedisQueueSnapshot> {
  if (hasRedisUrl()) {
    return readRedisQueueSnapshot(options)
  }

  const deadLetterPageSize = Math.max(1, Math.trunc(options?.deadLetterPageSize ?? 10))
  const delayedPageSize = Math.max(1, Math.trunc(options?.delayedPageSize ?? 10))
  const delayedPagination = buildPagination(0, normalizeRequestedWorkerLogPage(options?.delayedPage), delayedPageSize)
  const allDeadLetters = getInMemoryBackgroundJobDeadLetters()
  const deadLetterPagination = buildPagination(
    allDeadLetters.length,
    normalizeRequestedWorkerLogPage(options?.deadLetterPage),
    deadLetterPageSize,
  )
  const deadLetterStart = Math.max(0, (deadLetterPagination.page - 1) * deadLetterPagination.pageSize)
  const deadLetters = allDeadLetters.slice(deadLetterStart, deadLetterStart + deadLetterPagination.pageSize)
  return {
    streamLength: null,
    pendingCount: null,
    delayedCount: null,
    delayedPagination,
    deadLetterPagination,
    deadLetterCount: allDeadLetters.length,
    liveWorkers: [],
    delayedJobs: [],
    deadLetters,
  } satisfies RedisQueueSnapshot
}