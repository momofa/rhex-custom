// Sweeper for background jobs. Handles maintenance loop (stale entry claim,
// stream prune via XTRIM) and delayed-job promotion. Calls back into the
// worker via an injected processEntry function to re-drive claimed entries.
import type Redis from "ioredis"

import {
  getBackgroundJobDelayedPromotionBatchSize,
  getBackgroundJobPendingClaimBatchSize,
  getBackgroundJobPendingIdleMs,
  getBackgroundJobPruneSweepIntervalMs,
  getBackgroundJobStreamMaxLength,
} from "@/lib/background-job-config"
import { computeBackgroundJobLaneRestartDelayMs } from "@/lib/background-job-helpers"
import {
  getBackgroundJobConsumerGroupName,
  getBackgroundJobDelayedSetKey,
  getBackgroundJobIndexKey,
  getBackgroundJobStreamKey,
} from "@/lib/background-job-redis"
import { logError, logInfo } from "@/lib/logger"
import { connectRedisClient, createRedisConnection } from "@/lib/redis"
import { sleep } from "@/lib/shared/async"

import {
  isRedisUnknownCommandError,
  normalizeAutoClaimEntries,
  normalizePendingEntries,
  normalizeStreamEntries,
  type RedisBackgroundJobTransport,
  type RedisStreamEntry,
} from "./transport"

type BackgroundJobSweeperRedisCommands = Redis & {
  backgroundJobPromoteDueDelayed: (
    delayedKey: string,
    streamKey: string,
    indexKey: string,
    nowMs: string,
    limit: string,
    maxLength: string,
  ) => Promise<number>
}

export type ProcessEntryFn = (
  redis: Redis,
  entry: RedisStreamEntry,
  consumerName: string,
) => Promise<void>

export class BackgroundJobSweeper {
  private staleEntryClaimStrategy: "xautoclaim" | "xclaim" = "xautoclaim"

  constructor(
    private readonly workerId: string,
    private readonly transport: RedisBackgroundJobTransport,
    private readonly processEntry: ProcessEntryFn,
  ) {}

  async runMaintenanceLoop() {
    const consumerName = `${this.workerId}:maintenance`
    let consecutiveFailureCount = 0

    while (true) {
      const redis = createRedisConnection("background-job:maintenance")

      try {
        await connectRedisClient(redis)
        await this.transport.ensureReady()

        while (true) {
          await sleep(getBackgroundJobPruneSweepIntervalMs())

          await this.processStaleEntries(redis, consumerName)

          try {
            await redis.call(
              "XTRIM",
              getBackgroundJobStreamKey(),
              "MAXLEN",
              "~",
              String(getBackgroundJobStreamMaxLength()),
            )
          } catch (trimError) {
            logError(
              {
                scope: "background-job",
                action: "maintenance-xtrim",
                metadata: {
                  workerId: this.workerId,
                  consumerName,
                },
              },
              trimError,
            )
          }

          consecutiveFailureCount = 0
        }
      } catch (error) {
        consecutiveFailureCount += 1
        logError(
          {
            scope: "background-job",
            action: "maintenance-loop",
            metadata: {
              workerId: this.workerId,
              consumerName,
              consecutiveFailureCount,
            },
          },
          error,
        )
      } finally {
        redis.disconnect()
      }

      const restartDelayMs = computeBackgroundJobLaneRestartDelayMs(consecutiveFailureCount)
      await sleep(restartDelayMs)
    }
  }

  async processStaleEntries(redis: Redis, consumerName: string) {
    const claimedEntries = this.staleEntryClaimStrategy === "xclaim"
      ? await this.processStaleEntriesWithXClaim(redis, consumerName)
      : await this.processStaleEntriesWithAutoClaim(redis, consumerName)

    for (const entry of claimedEntries) {
      await this.processEntry(redis, entry, consumerName)
    }
  }

  private async processStaleEntriesWithAutoClaim(redis: Redis, consumerName: string) {
    try {
      const response = await redis.call(
        "XAUTOCLAIM",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        consumerName,
        String(getBackgroundJobPendingIdleMs()),
        "0-0",
        "COUNT",
        String(getBackgroundJobPendingClaimBatchSize()),
      )

      return normalizeAutoClaimEntries(response)
    } catch (error) {
      if (!isRedisUnknownCommandError(error, "XAUTOCLAIM")) {
        throw error
      }

      this.staleEntryClaimStrategy = "xclaim"
      logInfo({
        scope: "background-job",
        action: "stale-claim-compat",
        metadata: {
          workerId: this.workerId,
          strategy: "XPENDING+XCLAIM",
        },
      })

      return this.processStaleEntriesWithXClaim(redis, consumerName)
    }
  }

  private async processStaleEntriesWithXClaim(redis: Redis, consumerName: string) {
    const maxClaimCount = getBackgroundJobPendingClaimBatchSize()
    const minIdleMs = getBackgroundJobPendingIdleMs()
    const scanPageSize = Math.max(2, maxClaimCount)
    const maxScanCount = scanPageSize * 10
    const claimedEntries: RedisStreamEntry[] = []
    let cursor = "-"
    let scannedCount = 0

    while (claimedEntries.length < maxClaimCount && scannedCount < maxScanCount) {
      const pendingEntriesResponse = await redis.call(
        "XPENDING",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        cursor,
        "+",
        String(scanPageSize),
      )
      let pendingEntries = normalizePendingEntries(pendingEntriesResponse)

      if (pendingEntries.length === 0) {
        break
      }

      // Redis < 6.2 doesn't support exclusive range cursors for XPENDING, so
      // subsequent pages may repeat the previous last entry.
      if (cursor !== "-" && pendingEntries[0]?.id === cursor) {
        pendingEntries = pendingEntries.slice(1)
      }

      if (pendingEntries.length === 0) {
        break
      }

      scannedCount += pendingEntries.length
      cursor = pendingEntries[pendingEntries.length - 1]?.id ?? cursor

      const remainingClaimCount = maxClaimCount - claimedEntries.length
      const stalePendingIds = pendingEntries
        .filter((entry) => entry.idleMs >= minIdleMs)
        .slice(0, remainingClaimCount)
        .map((entry) => entry.id)

      if (stalePendingIds.length === 0) {
        if (pendingEntries.length < scanPageSize) {
          break
        }

        continue
      }

      const response = await redis.call(
        "XCLAIM",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        consumerName,
        String(minIdleMs),
        ...stalePendingIds,
      )

      claimedEntries.push(...normalizeStreamEntries(response))

      if (pendingEntries.length < scanPageSize) {
        break
      }
    }

    return claimedEntries
  }

  async promoteDueDelayedJobs(redis: Redis) {
    const movedCount = await (redis as BackgroundJobSweeperRedisCommands).backgroundJobPromoteDueDelayed(
      getBackgroundJobDelayedSetKey(),
      getBackgroundJobStreamKey(),
      getBackgroundJobIndexKey(),
      String(Date.now()),
      String(getBackgroundJobDelayedPromotionBatchSize()),
      String(getBackgroundJobStreamMaxLength()),
    )

    const promoted = Number(movedCount)

    if (promoted > 0) {
      logInfo({
        scope: "background-job",
        action: "promote-delayed",
        metadata: {
          workerId: this.workerId,
          promoted,
        },
      })
    }
  }
}
