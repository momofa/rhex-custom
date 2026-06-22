// Redis transport for background jobs. Extracted from redis-background-jobs.ts.

import type Redis from "ioredis"

import {
  getBackgroundJobFullScanMaxEntries,
  getBackgroundJobStreamMaxLength,
} from "@/lib/background-job-config"
import {
  dedupeBackgroundJobsById,
  matchesBackgroundJob,
} from "@/lib/background-job-helpers"
import {
  parseBackgroundJobIndexRecord,
} from "@/lib/redis-background-jobs/index-store"
import {
  type BackgroundJobFindOptions,
  type BackgroundJobDeleteOptions,
  type BackgroundJobDeleteResult,
  type BackgroundJobEnqueueResult,
  type BackgroundJobDeadLetterRecord,
  parseBackgroundJobEnvelopeString,
  type BackgroundJobEnvelope,
  type BackgroundJobTransport,
} from "@/lib/background-jobs"
import {
  getBackgroundJobConsumerGroupName,
  getBackgroundJobDeadLetterKey,
  getBackgroundJobDelayedSetKey,
  getBackgroundJobIndexKey,
  getBackgroundJobStreamKey,
} from "@/lib/background-job-redis"
import { logInfo } from "@/lib/logger"
import { connectRedisClient, createRedisConnection } from "@/lib/redis"

export type RedisStreamEntry = {
  id: string
  fields: Record<string, string>
}

export type RedisPendingEntry = {
  id: string
  idleMs: number
}
export function normalizeStreamEntries(value: unknown): RedisStreamEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2 || typeof entry[0] !== "string" || !Array.isArray(entry[1])) {
      return []
    }

    const fieldValues = entry[1]
    const fields: Record<string, string> = {}

    for (let index = 0; index < fieldValues.length; index += 2) {
      const key = fieldValues[index]
      const fieldValue = fieldValues[index + 1]

      if (typeof key !== "undefined" && typeof fieldValue !== "undefined") {
        fields[String(key)] = String(fieldValue)
      }
    }

    return [{
      id: entry[0],
      fields,
    }]
  })
}

export function normalizeReadGroupEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as RedisStreamEntry[]
  }

  return value.flatMap((streamChunk) => {
    if (!Array.isArray(streamChunk) || streamChunk.length < 2) {
      return []
    }

    return normalizeStreamEntries(streamChunk[1])
  })
}

export function normalizeAutoClaimEntries(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) {
    return [] as RedisStreamEntry[]
  }

  return normalizeStreamEntries(value[1])
}

export function normalizePendingEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as RedisPendingEntry[]
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") {
      return []
    }

    return [{
      id: entry[0],
      idleMs: Number(entry[2] ?? 0),
    }]
  })
}

export function isRedisUnknownCommandError(error: unknown, command: string) {
  const message = error instanceof Error ? error.message : String(error)
  const normalizedMessage = message.toUpperCase()
  const normalizedCommand = command.toUpperCase()

  return normalizedMessage.includes("UNKNOWN COMMAND") && normalizedMessage.includes(normalizedCommand)
}

export function parseBackgroundJobEnvelope(entry: RedisStreamEntry): BackgroundJobEnvelope | null {
  const encodedJob = entry.fields.job

  if (!encodedJob) {
    return null
  }

  return parseBackgroundJobEnvelopeString(encodedJob)
}

export function parseDeadLetterRecord(value: string) {
  try {
    return JSON.parse(value) as BackgroundJobDeadLetterRecord
  } catch {
    return null
  }
}

type BackgroundJobRedisCommands = Redis & {
  backgroundJobEnqueueDelayed: (
    delayedKey: string,
    indexKey: string,
    score: string,
    jobId: string,
    encodedJob: string,
  ) => Promise<number>
  backgroundJobPushToStream: (
    streamKey: string,
    indexKey: string,
    jobId: string,
    encodedJob: string,
    maxLength: string,
  ) => Promise<string>
}

const REDIS_SCAN_PAGE_SIZE = 200

async function scanDelayedJobMembers(
  redis: Redis,
  visit: (member: string) => boolean | Promise<boolean>,
) {
  let start = 0
  let scannedCount = 0
  const scanLimit = getBackgroundJobFullScanMaxEntries()

  while (scannedCount < scanLimit) {
    const stop = start + REDIS_SCAN_PAGE_SIZE - 1
    const members = await redis.zrange(getBackgroundJobDelayedSetKey(), start, stop)
    if (members.length === 0) {
      break
    }

    for (const member of members) {
      if (await visit(member)) {
        return
      }
    }

    scannedCount += members.length
    if (members.length < REDIS_SCAN_PAGE_SIZE) {
      break
    }
    start += REDIS_SCAN_PAGE_SIZE
  }

  if (scannedCount >= scanLimit) {
    logInfo({
      scope: "background-job",
      action: "scan-delayed-truncated",
      metadata: { scannedCount, scanLimit },
    })
  }
}

async function scanDeadLetterItems(
  redis: Redis,
  visit: (item: string) => boolean | Promise<boolean>,
) {
  let start = 0
  let scannedCount = 0
  const scanLimit = getBackgroundJobFullScanMaxEntries()

  while (scannedCount < scanLimit) {
    const stop = start + REDIS_SCAN_PAGE_SIZE - 1
    const items = await redis.lrange(getBackgroundJobDeadLetterKey(), start, stop)
    if (items.length === 0) {
      break
    }

    for (const item of items) {
      if (await visit(item)) {
        return
      }
    }

    scannedCount += items.length
    if (items.length < REDIS_SCAN_PAGE_SIZE) {
      break
    }
    start += REDIS_SCAN_PAGE_SIZE
  }

  if (scannedCount >= scanLimit) {
    logInfo({
      scope: "background-job",
      action: "scan-dead-letter-truncated",
      metadata: { scannedCount, scanLimit },
    })
  }
}

export class RedisBackgroundJobTransport implements BackgroundJobTransport {
  private readonly redis = createRedisConnection("background-job:transport")
  private groupReadyPromise: Promise<void> | null = null

  async enqueue<Name extends BackgroundJobEnvelope["name"]>(job: BackgroundJobEnvelope<Name>): Promise<BackgroundJobEnqueueResult<Name>> {
    await this.ensureReady()

    const encodedJob = JSON.stringify(job)
    const availableAt = job.availableAt ? new Date(job.availableAt).getTime() : 0

    if (availableAt > Date.now()) {
      await (this.redis as BackgroundJobRedisCommands).backgroundJobEnqueueDelayed(
        getBackgroundJobDelayedSetKey(),
        getBackgroundJobIndexKey(),
        String(availableAt),
        job.id,
        encodedJob,
      )
      return { job }
    }

    await this.pushToStream(job.id, encodedJob)
    return { job }
  }

  async writeDelayedJobIndex(redis: Redis, jobId: string, encodedJob: string) {
    await redis.hset(getBackgroundJobIndexKey(), jobId, JSON.stringify({ jobId, location: "delayed", encodedJob }))
  }

  async writeStreamJobIndex(redis: Redis, jobId: string, entryId: string) {
    await redis.hset(getBackgroundJobIndexKey(), jobId, JSON.stringify({ jobId, location: "stream", entryId }))
  }

  async writeDeadLetterJobIndex(redis: Redis, jobId: string, deadLetterValue: string) {
    await redis.hset(getBackgroundJobIndexKey(), jobId, JSON.stringify({ jobId, location: "dead-letter", deadLetterValue }))
  }

  async deleteJobIndex(redis: Redis, jobId: string) {
    await redis.hdel(getBackgroundJobIndexKey(), jobId)
  }

  async readJobIndex(redis: Redis, jobId: string) {
    return parseBackgroundJobIndexRecord(await redis.hget(getBackgroundJobIndexKey(), jobId))
  }

  private async findIndexedJob(
    redis: Redis,
    jobId: string,
    options?: BackgroundJobFindOptions,
  ): Promise<BackgroundJobEnvelope | null> {
    const indexRecord = await this.readJobIndex(redis, jobId)
    if (!indexRecord) {
      return null
    }

    if (indexRecord.location === "delayed" && indexRecord.encodedJob) {
      const stillQueued = await redis.zscore(getBackgroundJobDelayedSetKey(), indexRecord.encodedJob)
      if (stillQueued === null) {
        await this.deleteJobIndex(redis, jobId)
        return null
      }

      const job = parseBackgroundJobEnvelopeString(indexRecord.encodedJob)
      return job && matchesBackgroundJob(job, options) ? job : null
    }

    if (indexRecord.location === "stream" && indexRecord.entryId) {
      const response = await redis.call(
        "XRANGE",
        getBackgroundJobStreamKey(),
        indexRecord.entryId,
        indexRecord.entryId,
        "COUNT",
        "1",
      )
      const entry = normalizeStreamEntries(response)[0]
      if (!entry) {
        await this.deleteJobIndex(redis, jobId)
        return null
      }

      const job = parseBackgroundJobEnvelope(entry)
      return job && matchesBackgroundJob(job, options) ? job : null
    }

    if (indexRecord.location === "dead-letter" && indexRecord.deadLetterValue) {
      const listPosition = await redis.call(
        "LPOS",
        getBackgroundJobDeadLetterKey(),
        indexRecord.deadLetterValue,
      ).catch(() => null)
      if (listPosition === null) {
        await this.deleteJobIndex(redis, jobId)
        return null
      }

      const record = parseDeadLetterRecord(indexRecord.deadLetterValue)
      return record?.job && matchesBackgroundJob(record.job, options) ? record.job : null
    }

    await this.deleteJobIndex(redis, jobId)
    return null
  }

  async deleteById(
    jobId: string,
    options?: BackgroundJobDeleteOptions,
  ): Promise<BackgroundJobDeleteResult> {
    await this.ensureReady()

    const removedFrom = new Set<BackgroundJobDeleteResult["removedFrom"][number]>()
    const indexedJob = await this.findIndexedJob(this.redis, jobId, options)
    const indexRecord = indexedJob ? await this.readJobIndex(this.redis, jobId) : null

    if (indexedJob && indexRecord?.location === "delayed" && indexRecord.encodedJob) {
      const removedCount = await this.redis.zrem(getBackgroundJobDelayedSetKey(), indexRecord.encodedJob)
      if (removedCount > 0) {
        removedFrom.add("delayed")
        await this.deleteJobIndex(this.redis, jobId)
      }
    }

    if (indexedJob && indexRecord?.location === "stream" && indexRecord.entryId) {
      await this.redis.call(
        "XACK",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        indexRecord.entryId,
      ).catch(() => null)

      const deletedCount = await this.redis.call(
        "XDEL",
        getBackgroundJobStreamKey(),
        indexRecord.entryId,
      ).catch(() => 0)

      if (Number(deletedCount) > 0) {
        removedFrom.add("stream")
        await this.deleteJobIndex(this.redis, jobId)
      }
    }

    if (indexedJob && indexRecord?.location === "dead-letter" && indexRecord.deadLetterValue) {
      const removedCount = await this.redis.lrem(getBackgroundJobDeadLetterKey(), 1, indexRecord.deadLetterValue)
      if (removedCount > 0) {
        removedFrom.add("dead-letter")
        await this.deleteJobIndex(this.redis, jobId)
      }
    }

    if (removedFrom.size > 0) {
      return {
        id: jobId,
        removed: true,
        removedFrom: [...removedFrom.values()],
      }
    }

    await scanDelayedJobMembers(this.redis, async (member) => {
      const job = parseBackgroundJobEnvelopeString(member)
      if (!job || job.id !== jobId || (options?.match && !options.match(job))) {
        return false
      }

      const removedCount = await this.redis.zrem(getBackgroundJobDelayedSetKey(), member)
      if (removedCount > 0) {
        removedFrom.add("delayed")
      }
      return true
    })

    const streamEntryId = await this.findStreamEntryIdByJobId(jobId, options)
    if (streamEntryId) {
      await this.redis.call(
        "XACK",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        streamEntryId,
      ).catch(() => null)

      const deletedCount = await this.redis.call(
        "XDEL",
        getBackgroundJobStreamKey(),
        streamEntryId,
      ).catch(() => 0)

      if (Number(deletedCount) > 0) {
        removedFrom.add("stream")
      }
    }

    await scanDeadLetterItems(this.redis, async (item) => {
      const record = parseDeadLetterRecord(item)
      if (!record || record.job.id !== jobId || (options?.match && !options.match(record.job))) {
        return false
      }

      const removedCount = await this.redis.lrem(getBackgroundJobDeadLetterKey(), 1, item)
      if (removedCount > 0) {
        removedFrom.add("dead-letter")
      }
      return true
    })

    return {
      id: jobId,
      removed: removedFrom.size > 0,
      removedFrom: [...removedFrom.values()],
    }
  }

  async findById(
    jobId: string,
    options?: BackgroundJobFindOptions,
  ): Promise<BackgroundJobEnvelope | null> {
    await this.ensureReady()
    const indexedJob = await this.findIndexedJob(this.redis, jobId, options)
    if (indexedJob) {
      return indexedJob
    }

    const [job] = await this.listJobs(options, jobId)
    return job ?? null
  }

  async list(
    options?: BackgroundJobFindOptions,
  ): Promise<BackgroundJobEnvelope[]> {
    return this.listJobs(options)
  }

  private async listJobs(
    options?: BackgroundJobFindOptions,
    jobId?: string,
  ): Promise<BackgroundJobEnvelope[]> {
    await this.ensureReady()
    const matches = (job: BackgroundJobEnvelope) =>
      (!jobId || job.id === jobId)
      && (!options?.match || options.match(job))
    const jobs: BackgroundJobEnvelope[] = []

    await scanDelayedJobMembers(this.redis, (member) => {
      const job = parseBackgroundJobEnvelopeString(member)
      if (job && matches(job)) {
        jobs.push(job)
      }
      return Boolean(jobId && job?.id === jobId)
    })

    let cursor = "-"
    let scannedCount = 0
    const scanLimit = getBackgroundJobFullScanMaxEntries()

    while (true) {
      const response = await this.redis.call(
        "XRANGE",
        getBackgroundJobStreamKey(),
        cursor,
        "+",
        "COUNT",
        "200",
      )
      const entries = normalizeStreamEntries(response)
      let pageEntries = entries

      if (cursor !== "-" && pageEntries[0]?.id === cursor) {
        pageEntries = pageEntries.slice(1)
      }

      if (pageEntries.length === 0) {
        break
      }

      for (const entry of pageEntries) {
        const job = parseBackgroundJobEnvelope(entry)
        if (job && matches(job)) {
          jobs.push(job)
        }
      }

      scannedCount += pageEntries.length
      cursor = pageEntries[pageEntries.length - 1]?.id ?? cursor
      if (pageEntries.length < 200) {
        break
      }
      if (scannedCount >= scanLimit) {
        logInfo({
          scope: "background-job",
          action: "find-jobs-scan-truncated",
          metadata: {
            scannedCount,
            scanLimit,
            lastCursor: cursor,
          },
        })
        break
      }
    }

    await scanDeadLetterItems(this.redis, (item) => {
      const record = parseDeadLetterRecord(item)
      if (record?.job && matches(record.job)) {
        jobs.push(record.job)
      }
      return Boolean(jobId && record?.job.id === jobId)
    })

    return dedupeBackgroundJobsById(jobs)
  }

  async pushToStream(jobId: string, encodedJob: string) {
    const streamKey = getBackgroundJobStreamKey()
    const streamMaxLength = getBackgroundJobStreamMaxLength()

    await (this.redis as BackgroundJobRedisCommands).backgroundJobPushToStream(
      streamKey,
      getBackgroundJobIndexKey(),
      jobId,
      encodedJob,
      String(streamMaxLength),
    )
  }

  async ensureReady() {
    await connectRedisClient(this.redis)
    await this.ensureConsumerGroup()
  }

  async enqueueWithRedis(redis: Redis, job: BackgroundJobEnvelope) {
    const encodedJob = JSON.stringify(job)
    const availableAt = job.availableAt ? new Date(job.availableAt).getTime() : 0

    if (availableAt > Date.now()) {
      await (redis as BackgroundJobRedisCommands).backgroundJobEnqueueDelayed(
        getBackgroundJobDelayedSetKey(),
        getBackgroundJobIndexKey(),
        String(availableAt),
        job.id,
        encodedJob,
      )
      return
    }

    await this.pushToStreamWithRedis(redis, job.id, encodedJob)
  }

  async pushToStreamWithRedis(redis: Redis, jobId: string, encodedJob: string) {
    const streamKey = getBackgroundJobStreamKey()
    const streamMaxLength = getBackgroundJobStreamMaxLength()

    await (redis as BackgroundJobRedisCommands).backgroundJobPushToStream(
      streamKey,
      getBackgroundJobIndexKey(),
      jobId,
      encodedJob,
      String(streamMaxLength),
    )
  }

  private async ensureConsumerGroup() {
    this.groupReadyPromise ??= (async () => {
      try {
        await this.redis.call(
          "XGROUP",
          "CREATE",
          getBackgroundJobStreamKey(),
          getBackgroundJobConsumerGroupName(),
          "0",
          "MKSTREAM",
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        if (!message.includes("BUSYGROUP")) {
          throw error
        }
      }
    })()

    return this.groupReadyPromise
  }

  private async findStreamEntryIdByJobId(
    jobId: string,
    options?: BackgroundJobDeleteOptions,
  ) {
    let cursor = "-"
    let scannedCount = 0
    const scanLimit = getBackgroundJobFullScanMaxEntries()

    while (true) {
      const response = await this.redis.call(
        "XRANGE",
        getBackgroundJobStreamKey(),
        cursor,
        "+",
        "COUNT",
        "200",
      )
      const entries = normalizeStreamEntries(response)
      let pageEntries = entries

      if (cursor !== "-" && pageEntries[0]?.id === cursor) {
        pageEntries = pageEntries.slice(1)
      }

      if (pageEntries.length === 0) {
        return null
      }

      for (const entry of pageEntries) {
        const job = parseBackgroundJobEnvelope(entry)
        if (!job || job.id !== jobId || (options?.match && !options.match(job))) {
          continue
        }

        return entry.id
      }

      scannedCount += pageEntries.length
      cursor = pageEntries[pageEntries.length - 1]?.id ?? cursor
      if (pageEntries.length < 200) {
        return null
      }
      if (scannedCount >= scanLimit) {
        logInfo({
          scope: "background-job",
          action: "find-stream-entry-scan-truncated",
          targetId: jobId,
          metadata: {
            scannedCount,
            scanLimit,
            lastCursor: cursor,
          },
        })
        return null
      }
    }
  }
}
