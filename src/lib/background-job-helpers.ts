import {
  getBackgroundJobLaneRestartBaseDelayMs,
  getBackgroundJobLaneRestartMaxDelayMs,
} from "@/lib/background-job-config"
import type {
  BackgroundJobDeleteOptions,
  BackgroundJobEnvelope,
  BackgroundJobFindOptions,
} from "@/lib/background-jobs"

/**
 * Evaluates an optional `match` predicate against a background job envelope.
 *
 * Extracted from `background-jobs.ts` and `redis-background-jobs.ts` where
 * three byte-identical copies previously existed (`matchesBackgroundJob`
 * in both files and `matchesIndexedBackgroundJob` in the redis module).
 */
export function matchesBackgroundJob(
  job: BackgroundJobEnvelope,
  options?: BackgroundJobFindOptions | BackgroundJobDeleteOptions,
) {
  return !options?.match || options.match(job)
}

/**
 * Removes duplicate envelopes by id while preserving the original order.
 *
 * Previously duplicated between the in-memory and Redis transports.
 */
export function dedupeBackgroundJobsById(jobs: BackgroundJobEnvelope[]) {
  const seen = new Set<string>()
  const deduped: BackgroundJobEnvelope[] = []

  for (const job of jobs) {
    if (seen.has(job.id)) {
      continue
    }

    seen.add(job.id)
    deduped.push(job)
  }

  return deduped
}

/**
 * Computes exponential backoff with jitter for background-job lane restarts.
 *
 * Shared by the lane worker and the maintenance sweeper so both loops use
 * the same failure-aware restart cadence.
 */
export function computeBackgroundJobLaneRestartDelayMs(consecutiveFailureCount: number) {
  const baseDelayMs = getBackgroundJobLaneRestartBaseDelayMs()
  const maxDelayMs = getBackgroundJobLaneRestartMaxDelayMs()
  const exponent = Math.max(0, Math.trunc(consecutiveFailureCount) - 1)
  const cappedBaseDelayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** exponent)
  const minJitterDelayMs = Math.max(baseDelayMs, Math.floor(cappedBaseDelayMs / 2))

  if (cappedBaseDelayMs <= minJitterDelayMs) {
    return cappedBaseDelayMs
  }

  const jitterRangeMs = cappedBaseDelayMs - minJitterDelayMs
  return minJitterDelayMs + Math.floor(Math.random() * (jitterRangeMs + 1))
}
