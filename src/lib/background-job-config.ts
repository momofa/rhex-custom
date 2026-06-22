import { parseBoundedInteger } from "@/lib/shared/number-parsers"

// ============================================================================
// In-memory transport
// ============================================================================

export const DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY = 10
export const MAX_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY = 32
export const DEFAULT_IN_MEMORY_BACKGROUND_JOB_DEAD_LETTER_MAX_LENGTH = 200

export function getInMemoryBackgroundJobDeadLetterMaxLength() {
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_IN_MEMORY_DEAD_LETTER_MAX_LENGTH,
    DEFAULT_IN_MEMORY_BACKGROUND_JOB_DEAD_LETTER_MAX_LENGTH,
    { min: 10, max: 10_000 },
  )
}

export function getInMemoryBackgroundJobConcurrency() {
  const rawValue = process.env.BACKGROUND_JOB_CONCURRENCY?.trim()

  if (!rawValue) {
    return DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY
  }

  return Math.min(MAX_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY, parsed)
}

// ============================================================================
// Retry / attempts (applies to both transports)
// ============================================================================

export const DEFAULT_BACKGROUND_JOB_MAX_ATTEMPTS = 3
export const DEFAULT_BACKGROUND_JOB_RETRY_BASE_MS = 5_000
export const DEFAULT_BACKGROUND_JOB_RETRY_MAX_MS = 5 * 60 * 1_000

export function getBackgroundJobMaxAttemptsFallback() {
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_MAX_ATTEMPTS,
    DEFAULT_BACKGROUND_JOB_MAX_ATTEMPTS,
    { min: 1, max: 20 },
  )
}

export function getBackgroundJobRetryBaseMs() {
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_RETRY_BASE_MS,
    DEFAULT_BACKGROUND_JOB_RETRY_BASE_MS,
    { min: 250, max: 60 * 60 * 1_000 },
  )
}

export function getBackgroundJobRetryMaxMs() {
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_RETRY_MAX_MS,
    DEFAULT_BACKGROUND_JOB_RETRY_MAX_MS,
    { min: 1_000, max: 24 * 60 * 60 * 1_000 },
  )
}

// ============================================================================
// Runtime mode detection (shared between jobs.ts and background-job-admin.ts)
// ============================================================================

/**
 * Returns the lowercased trimmed value of `BACKGROUND_JOB_WEB_RUNTIME`, or
 * `undefined` when unset. Callers decide whether to default to `"auto"` or
 * to inspect `NODE_ENV`.
 */
export function readBackgroundJobWebRuntimeMode() {
  return process.env.BACKGROUND_JOB_WEB_RUNTIME?.trim().toLowerCase()
}

/** `true` when `NODE_ENV !== "production"`. */
export function isBackgroundJobNonProductionNodeEnv() {
  return process.env.NODE_ENV !== "production"
}

// ============================================================================
// Redis transport
// ============================================================================

export const DEFAULT_STREAM_MAX_LENGTH = 10_000
export const DEFAULT_BLOCK_TIMEOUT_MS = 5_000
export const DEFAULT_READ_BATCH_SIZE = 10
export const DEFAULT_PENDING_IDLE_MS = 15 * 60 * 1_000
export const DEFAULT_PENDING_CLAIM_BATCH_SIZE = 20
export const DEFAULT_PENDING_SWEEP_INTERVAL_MS = 15_000
export const DEFAULT_PRUNE_SWEEP_INTERVAL_MS = 60_000
export const DEFAULT_LANE_RESTART_BASE_DELAY_MS = 1_000
export const DEFAULT_LANE_RESTART_MAX_DELAY_MS = 30_000
export const DEFAULT_DELAYED_PROMOTION_BATCH_SIZE = 50
export const DEFAULT_DEAD_LETTER_MAX_LENGTH = 1_000
export const DEFAULT_FULL_SCAN_MAX_ENTRIES = 10_000
export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60

export function getBackgroundJobStreamMaxLength() {
  return parseBoundedInteger(process.env.BACKGROUND_JOB_STREAM_MAX_LENGTH, DEFAULT_STREAM_MAX_LENGTH, { min: 100, max: 1_000_000 })
}

export function getBackgroundJobBlockTimeoutMs() {
  return parseBoundedInteger(process.env.BACKGROUND_JOB_BLOCK_TIMEOUT_MS, DEFAULT_BLOCK_TIMEOUT_MS, { min: 250, max: 60_000 })
}

export function getBackgroundJobReadBatchSize() {
  return parseBoundedInteger(process.env.BACKGROUND_JOB_READ_BATCH_SIZE, DEFAULT_READ_BATCH_SIZE, { min: 1, max: 200 })
}

export function getBackgroundJobPendingIdleMs() {
  return parseBoundedInteger(process.env.BACKGROUND_JOB_PENDING_IDLE_MS, DEFAULT_PENDING_IDLE_MS, { min: 5_000, max: 24 * 60 * 60 * 1_000 })
}

export function getBackgroundJobPendingClaimBatchSize() {
  return parseBoundedInteger(process.env.BACKGROUND_JOB_PENDING_CLAIM_BATCH_SIZE, DEFAULT_PENDING_CLAIM_BATCH_SIZE, { min: 1, max: 200 })
}

export function getBackgroundJobPendingSweepIntervalMs() {
  return parseBoundedInteger(process.env.BACKGROUND_JOB_PENDING_SWEEP_INTERVAL_MS, DEFAULT_PENDING_SWEEP_INTERVAL_MS, { min: 1_000, max: 60_000 })
}

export function getBackgroundJobPruneSweepIntervalMs() {
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_PRUNE_SWEEP_INTERVAL_MS,
    DEFAULT_PRUNE_SWEEP_INTERVAL_MS,
    { min: 5_000, max: 10 * 60 * 1_000 },
  )
}

export function getBackgroundJobDelayedPromotionBatchSize() {
  return parseBoundedInteger(process.env.BACKGROUND_JOB_DELAYED_PROMOTION_BATCH_SIZE, DEFAULT_DELAYED_PROMOTION_BATCH_SIZE, { min: 1, max: 500 })
}

export function getBackgroundJobDeadLetterMaxLength() {
  return parseBoundedInteger(process.env.BACKGROUND_JOB_DEAD_LETTER_MAX_LENGTH, DEFAULT_DEAD_LETTER_MAX_LENGTH, { min: 10, max: 100_000 })
}

export function getBackgroundJobFullScanMaxEntries() {
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_FULL_SCAN_MAX_ENTRIES,
    DEFAULT_FULL_SCAN_MAX_ENTRIES,
    { min: 200, max: 1_000_000 },
  )
}

export function getBackgroundJobIdempotencyTtlSeconds() {
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_IDEMPOTENCY_TTL_SECONDS,
    DEFAULT_IDEMPOTENCY_TTL_SECONDS,
    { min: 60, max: 7 * 24 * 60 * 60 },
  )
}

export function getBackgroundJobLaneRestartBaseDelayMs() {
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_LANE_RESTART_BASE_DELAY_MS,
    DEFAULT_LANE_RESTART_BASE_DELAY_MS,
    { min: 250, max: 60_000 },
  )
}

export function getBackgroundJobLaneRestartMaxDelayMs() {
  const baseDelayMs = getBackgroundJobLaneRestartBaseDelayMs()
  return parseBoundedInteger(
    process.env.BACKGROUND_JOB_LANE_RESTART_MAX_DELAY_MS,
    DEFAULT_LANE_RESTART_MAX_DELAY_MS,
    { min: baseDelayMs, max: 10 * 60 * 1_000 },
  )
}
