import type Redis from "ioredis"

import {
  getBackgroundJobBlockTimeoutMs,
  getBackgroundJobDeadLetterMaxLength,
  getBackgroundJobIdempotencyTtlSeconds,
  getBackgroundJobPendingSweepIntervalMs,
  getBackgroundJobReadBatchSize,
} from "@/lib/background-job-config"
import { computeBackgroundJobLaneRestartDelayMs } from "@/lib/background-job-helpers"
import {
  getBackgroundJobConsumerGroupName,
  getBackgroundJobDeadLetterKey,
  getBackgroundJobIdempotencyKey,
  getBackgroundJobStreamKey,
} from "@/lib/background-job-redis"
import {
  type BackgroundJobDeadLetterRecord,
  createBackgroundJobLogMetadata,
  executeBackgroundJobWithOutcome,
} from "@/lib/background-jobs"
import { logError, logInfo } from "@/lib/logger"
import { connectRedisClient, createRedisConnection } from "@/lib/redis"
import { sleep } from "@/lib/shared/async"
import type { BackgroundJobSweeper } from "@/lib/redis-background-jobs/sweeper"
import {
  type RedisBackgroundJobTransport,
  type RedisStreamEntry,
  normalizeReadGroupEntries,
  parseBackgroundJobEnvelope,
} from "@/lib/redis-background-jobs/transport"

/**
 * Drives a single Redis consumer lane:
 *   1. Reads new stream entries via XREADGROUP.
 *   2. Hands each entry to processEntry (shared with the sweeper's reclaim path).
 *   3. Restarts with exponential backoff on transport failures.
 *
 * processEntry is intentionally public so the sweeper can reuse the exact
 * same processing + ack pipeline when re-delivering stale pending jobs.
 */
export class BackgroundJobLaneWorker {
  constructor(
    private readonly workerId: string,
    private readonly transport: RedisBackgroundJobTransport,
    private readonly getSweeper: () => BackgroundJobSweeper,
  ) {}

  async runLane(laneIndex: number): Promise<void> {
    const consumerName = `${this.workerId}:${laneIndex}`
    let nextDelayedPromotionAt = 0
    let consecutiveFailureCount = 0

    while (true) {
      const redis = createRedisConnection(`background-job:lane:${laneIndex}`)

      try {
        await connectRedisClient(redis)
        await this.transport.ensureReady()

        while (true) {
          if (laneIndex === 0 && Date.now() >= nextDelayedPromotionAt) {
            await this.getSweeper().promoteDueDelayedJobs(redis)
            nextDelayedPromotionAt = Date.now() + getBackgroundJobPendingSweepIntervalMs()
          }

          const entries = await this.readNewEntries(redis, consumerName)
          consecutiveFailureCount = 0

          if (entries.length === 0) {
            continue
          }

          for (const entry of entries) {
            await this.processEntry(redis, entry, consumerName)
          }
        }
      } catch (error) {
        logError({
          scope: "background-job",
          action: "worker-lane",
          metadata: {
            workerId: this.workerId,
            consumerName,
            consecutiveFailureCount: consecutiveFailureCount + 1,
          },
        }, error)
      } finally {
        redis.disconnect()
      }

      consecutiveFailureCount += 1
      const restartDelayMs = computeBackgroundJobLaneRestartDelayMs(consecutiveFailureCount)
      logInfo({
        scope: "background-job",
        action: "worker-lane-restart",
        metadata: {
          workerId: this.workerId,
          consumerName,
          laneIndex,
          consecutiveFailureCount,
          restartDelayMs,
        },
      })
      await sleep(restartDelayMs)
    }
  }

  private async readNewEntries(redis: Redis, consumerName: string): Promise<RedisStreamEntry[]> {
    const response = await redis.call(
      "XREADGROUP",
      "GROUP",
      getBackgroundJobConsumerGroupName(),
      consumerName,
      "COUNT",
      String(getBackgroundJobReadBatchSize()),
      "BLOCK",
      String(getBackgroundJobBlockTimeoutMs()),
      "STREAMS",
      getBackgroundJobStreamKey(),
      ">",
    )

    return normalizeReadGroupEntries(response)
  }

  async processEntry(redis: Redis, entry: RedisStreamEntry, consumerName: string): Promise<void> {
    const job = parseBackgroundJobEnvelope(entry)

    if (!job) {
      logError({
        scope: "background-job",
        action: "decode",
        targetId: entry.id,
      }, new Error("Invalid background job payload"))

      await this.acknowledgeProcessedEntry(redis, entry.id)
      return
    }

    if (job.idempotencyKey) {
      const idemKey = getBackgroundJobIdempotencyKey(job.idempotencyKey)
      const ttlSeconds = getBackgroundJobIdempotencyTtlSeconds()
      const acquired = await redis.set(idemKey, job.id, "EX", ttlSeconds, "NX")
      if (!acquired) {
        const existing = await redis.get(idemKey).catch(() => null)
        if (existing && existing !== job.id) {
          logInfo({
            scope: "background-job",
            action: "idempotent-skip",
            targetId: entry.id,
            metadata: createBackgroundJobLogMetadata(job, {
              workerId: this.workerId,
              consumerName,
              transport: "redis",
              existingJobId: existing,
            }),
          })
          await this.acknowledgeProcessedEntry(redis, entry.id, job.id)
          return
        }
      }
    }

    await executeBackgroundJobWithOutcome(job, {
      baseMetadata: {
        workerId: this.workerId,
        consumerName,
        transport: "redis",
      },
      targetId: entry.id,
      enqueueRetry: (retryJob) => this.transport.enqueueWithRedis(redis, retryJob),
      persistDeadLetter: (record) => this.persistDeadLetter(redis, record),
    })

    await this.acknowledgeProcessedEntry(redis, entry.id, job.id)
  }

  private async persistDeadLetter(redis: Redis, record: BackgroundJobDeadLetterRecord): Promise<void> {
    const deadLetterKey = getBackgroundJobDeadLetterKey()
    const deadLetterMaxLength = getBackgroundJobDeadLetterMaxLength()
    const encodedRecord = JSON.stringify(record)

    await redis.multi()
      .lpush(deadLetterKey, encodedRecord)
      .ltrim(deadLetterKey, 0, deadLetterMaxLength - 1)
      .exec()
    await this.transport.writeDeadLetterJobIndex(redis, record.job.id, encodedRecord)
  }

  private async acknowledgeProcessedEntry(redis: Redis, entryId: string, jobId?: string): Promise<void> {
    const streamKey = getBackgroundJobStreamKey()
    const consumerGroup = getBackgroundJobConsumerGroupName()

    // Acknowledge first so the consumer group's pending list is cleaned up
    // before removing the stream entry itself.
    await redis.call(
      "XACK",
      streamKey,
      consumerGroup,
      entryId,
    )
    await redis.call(
      "XDEL",
      streamKey,
      entryId,
    )
    if (jobId) {
      const indexRecord = await this.transport.readJobIndex(redis, jobId)
      if (indexRecord?.location === "stream" && indexRecord.entryId === entryId) {
        await this.transport.deleteJobIndex(redis, jobId)
      }
    }
  }
}
