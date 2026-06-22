import { createRedisKey } from "@/lib/redis"
import { REDIS_KEY_SCOPES } from "@/lib/redis-keys"

export const BACKGROUND_JOB_EXECUTION_LOG_RETENTION_SECONDS = 24 * 60 * 60
export const BACKGROUND_JOB_EXECUTION_LOG_RETENTION_MS = BACKGROUND_JOB_EXECUTION_LOG_RETENTION_SECONDS * 1_000
export const BACKGROUND_JOB_EXECUTION_LOG_KEY_EXPIRE_SECONDS = BACKGROUND_JOB_EXECUTION_LOG_RETENTION_SECONDS * 2

export function getBackgroundJobStreamKey() {
  return createRedisKey(...REDIS_KEY_SCOPES.backgroundJobs.stream)
}

export function getBackgroundJobConsumerGroupName() {
  return createRedisKey(...REDIS_KEY_SCOPES.backgroundJobs.group)
}

export function getBackgroundJobDelayedSetKey() {
  return createRedisKey(...REDIS_KEY_SCOPES.backgroundJobs.delayed)
}

export function getBackgroundJobDeadLetterKey() {
  return createRedisKey(...REDIS_KEY_SCOPES.backgroundJobs.deadLetter)
}

export function getBackgroundJobIndexKey() {
  return createRedisKey(...REDIS_KEY_SCOPES.backgroundJobs.index)
}

export function getBackgroundJobExecutionLogKey() {
  return createRedisKey(...REDIS_KEY_SCOPES.backgroundJobs.executionLog)
}

export function getBackgroundJobIdempotencyKey(idempotencyKey: string) {
  return createRedisKey(...REDIS_KEY_SCOPES.backgroundJobs.idempotency, idempotencyKey)
}
