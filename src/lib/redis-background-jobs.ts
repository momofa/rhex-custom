import { randomUUID } from "node:crypto"

import {
  type BackgroundJobTransport,
  resolveBackgroundJobConcurrency,
} from "@/lib/background-jobs"
import { logInfo } from "@/lib/logger"
import { BackgroundJobLaneWorker } from "@/lib/redis-background-jobs/lane-worker"
import { BackgroundJobSweeper } from "@/lib/redis-background-jobs/sweeper"
import { RedisBackgroundJobTransport } from "@/lib/redis-background-jobs/transport"

type GlobalRedisBackgroundJobState = {
  __bbsRedisBackgroundJobRuntime?: RedisBackgroundJobRuntime
}

const globalForRedisBackgroundJobs = globalThis as typeof globalThis & GlobalRedisBackgroundJobState

/**
 * Thin composition root for the Redis-backed background-job worker.
 * Wires together the transport, per-lane worker and maintenance sweeper;
 * the substantive logic lives in the dedicated modules under
 * ./redis-background-jobs/.
 */
class RedisBackgroundJobRuntime {
  readonly workerId = randomUUID()
  readonly transport = new RedisBackgroundJobTransport()
  readonly laneWorker: BackgroundJobLaneWorker
  readonly sweeper: BackgroundJobSweeper

  private startPromise: Promise<void> | null = null
  private maintenanceLoopPromise: Promise<void> | null = null

  constructor() {
    // The lane worker and the sweeper have a mutual dependency:
    //   - the lane consults the sweeper to promote due delayed jobs;
    //   - the sweeper re-delivers stale pending entries through the lane's
    //     processEntry pipeline.
    // Both are fully initialised below before any work starts, so the
    // forward references captured in the closures are safe at call time.
    this.laneWorker = new BackgroundJobLaneWorker(
      this.workerId,
      this.transport,
      () => this.sweeper,
    )
    this.sweeper = new BackgroundJobSweeper(
      this.workerId,
      this.transport,
      (redis, entry, consumerName) => this.laneWorker.processEntry(redis, entry, consumerName),
    )
  }

  async start() {
    this.startPromise ??= this.startInternal()
    return this.startPromise
  }

  private async startInternal() {
    await this.transport.ensureReady()

    const concurrency = resolveBackgroundJobConcurrency()

    for (let laneIndex = 0; laneIndex < concurrency; laneIndex += 1) {
      void this.laneWorker.runLane(laneIndex)
    }

    this.maintenanceLoopPromise ??= this.sweeper.runMaintenanceLoop()
    void this.maintenanceLoopPromise

    logInfo({
      scope: "background-job",
      action: "worker-start",
      metadata: {
        workerId: this.workerId,
        concurrency,
      },
    })
  }
}

function getRedisBackgroundJobRuntime() {
  const runtime = globalForRedisBackgroundJobs.__bbsRedisBackgroundJobRuntime ?? new RedisBackgroundJobRuntime()

  if (!globalForRedisBackgroundJobs.__bbsRedisBackgroundJobRuntime) {
    globalForRedisBackgroundJobs.__bbsRedisBackgroundJobRuntime = runtime
  }

  return runtime
}

export async function getRedisBackgroundJobTransport(): Promise<BackgroundJobTransport> {
  const runtime = getRedisBackgroundJobRuntime()
  await runtime.transport.ensureReady()
  return runtime.transport
}

export async function ensureRedisBackgroundJobWorkerRunning() {
  const runtime = getRedisBackgroundJobRuntime()
  await runtime.start()
}