import {
  listRssQueueItemsBySource,
  type RssQueueRecord,
} from "@/lib/rss-harvest-queue-store"
import { connectRedisClient, createRedisKey, getRedis } from "@/lib/redis"
import { REDIS_KEY_SCOPES } from "@/lib/redis-keys"

export interface RssSourceRuntimeState {
  sourceId: string
  enabled: boolean
  lastRunAt: Date | null
  lastSuccessAt: Date | null
  lastErrorAt: Date | null
  lastErrorMessage: string | null
  failureCount: number
  lastRunDurationMs: number | null
  updatedAt: Date
}

export interface RssSourceRuntimeStatePatch {
  enabled?: boolean
  lastRunAt?: Date | null
  lastSuccessAt?: Date | null
  lastErrorAt?: Date | null
  lastErrorMessage?: string | null
  failureCount?: number
  lastRunDurationMs?: number | null
  updatedAt?: Date
}

const RSS_SOURCE_RUNTIME_STATE_KEY = createRedisKey(...REDIS_KEY_SCOPES.rssHarvest.sourceRuntimeItems)
const RSS_RUNTIME_STATE_DERIVATION_QUEUE_LIMIT = 200

function toDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function createDefaultRuntimeState(sourceId: string): RssSourceRuntimeState {
  return {
    sourceId,
    enabled: false,
    lastRunAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
    lastRunDurationMs: null,
    updatedAt: new Date(),
  }
}

function serializeRuntimeState(state: RssSourceRuntimeState) {
  return JSON.stringify({
    ...state,
    lastRunAt: state.lastRunAt?.toISOString() ?? null,
    lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null,
    lastErrorAt: state.lastErrorAt?.toISOString() ?? null,
    updatedAt: state.updatedAt.toISOString(),
  })
}

function parseRuntimeState(sourceId: string, rawValue: string | null | undefined) {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    const updatedAt = toDate(typeof parsed.updatedAt === "string" ? parsed.updatedAt : null)
    if (!updatedAt) {
      return null
    }

    return {
      sourceId,
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : false,
      lastRunAt: toDate(typeof parsed.lastRunAt === "string" ? parsed.lastRunAt : null),
      lastSuccessAt: toDate(typeof parsed.lastSuccessAt === "string" ? parsed.lastSuccessAt : null),
      lastErrorAt: toDate(typeof parsed.lastErrorAt === "string" ? parsed.lastErrorAt : null),
      lastErrorMessage: typeof parsed.lastErrorMessage === "string" ? parsed.lastErrorMessage : null,
      failureCount: typeof parsed.failureCount === "number" && Number.isFinite(parsed.failureCount)
        ? Math.max(0, Math.trunc(parsed.failureCount))
        : 0,
      lastRunDurationMs: typeof parsed.lastRunDurationMs === "number" && Number.isFinite(parsed.lastRunDurationMs)
        ? Math.max(0, Math.trunc(parsed.lastRunDurationMs))
        : null,
      updatedAt,
    } satisfies RssSourceRuntimeState
  } catch {
    return null
  }
}

function isAutomaticQueueItem(item: RssQueueRecord) {
  return item.triggerType !== "MANUAL"
}

function isActiveQueueItem(item: RssQueueRecord) {
  return item.status === "PENDING" || item.status === "PROCESSING"
}

function buildRuntimeStateFromQueueItems(sourceId: string, queueItems: RssQueueRecord[]) {
  const recentRuns = queueItems
    .filter((item) => Boolean(item.startedAt))
    .sort((left, right) => {
      const leftTime = left.startedAt?.getTime() ?? left.createdAt.getTime()
      const rightTime = right.startedAt?.getTime() ?? right.createdAt.getTime()
      return rightTime - leftTime
    })
  const latestRun = recentRuns[0] ?? null
  const latestSuccess = recentRuns.find((item) => item.status === "SUCCEEDED") ?? null
  const latestError = recentRuns.find((item) => item.status === "FAILED" || item.status === "CANCELLED") ?? null

  let failureCount = 0
  for (const run of recentRuns) {
    if (run.status === "SUCCEEDED") {
      break
    }

    if (run.status === "FAILED" || run.status === "CANCELLED") {
      failureCount += 1
    }
  }

  const hasAutomaticActiveItem = queueItems.some((item) => isActiveQueueItem(item) && isAutomaticQueueItem(item))

  return {
    sourceId,
    enabled: hasAutomaticActiveItem,
    lastRunAt: latestRun?.startedAt ?? null,
    lastSuccessAt: latestSuccess?.finishedAt ?? latestSuccess?.startedAt ?? null,
    lastErrorAt: latestError?.finishedAt ?? latestError?.startedAt ?? null,
    lastErrorMessage: latestError?.errorMessage ?? null,
    failureCount,
    lastRunDurationMs: latestRun?.durationMs ?? null,
    updatedAt: new Date(),
  } satisfies RssSourceRuntimeState
}

async function readRuntimeStates(sourceIds: string[]) {
  if (sourceIds.length === 0) {
    return new Map<string, RssSourceRuntimeState>()
  }

  const redis = getRedis()
  await connectRedisClient(redis)
  const rawValues = await redis.hmget(RSS_SOURCE_RUNTIME_STATE_KEY, ...sourceIds)
  const entries = sourceIds.flatMap((sourceId, index) => {
    const state = parseRuntimeState(sourceId, rawValues[index])
    return state ? [[sourceId, state] as const] : []
  })
  return new Map(entries)
}

async function persistRuntimeState(state: RssSourceRuntimeState) {
  await persistRuntimeStates([state])
}

async function persistRuntimeStates(states: RssSourceRuntimeState[]) {
  if (states.length === 0) {
    return
  }

  const redis = getRedis()
  await connectRedisClient(redis)
  const fieldValues = states.flatMap((state) => [state.sourceId, serializeRuntimeState(state)])
  await redis.hset(RSS_SOURCE_RUNTIME_STATE_KEY, ...fieldValues)
}

function applyRuntimePatch(current: RssSourceRuntimeState, patch: RssSourceRuntimeStatePatch) {
  return {
    ...current,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date(),
  } satisfies RssSourceRuntimeState
}

export async function getRssSourceRuntimeState(sourceId: string) {
  const states = await listRssSourceRuntimeStates([sourceId])
  return states.get(sourceId) ?? createDefaultRuntimeState(sourceId)
}

export async function listRssSourceRuntimeStates(sourceIds: string[], options?: {
  queueItemsBySource?: Map<string, RssQueueRecord[]>
}) {
  const uniqueSourceIds = Array.from(new Set(sourceIds))
  const existingStates = await readRuntimeStates(uniqueSourceIds)
  const missingSourceIds = uniqueSourceIds.filter((sourceId) => !existingStates.has(sourceId))

  if (missingSourceIds.length === 0) {
    return existingStates
  }

  const resolvedQueueItemsBySource = options?.queueItemsBySource ?? (() => {
    const map = new Map<string, RssQueueRecord[]>()
    return map
  })()
  if (!options?.queueItemsBySource) {
    await Promise.all(missingSourceIds.map(async (sourceId) => {
      resolvedQueueItemsBySource.set(
        sourceId,
        await listRssQueueItemsBySource(sourceId, RSS_RUNTIME_STATE_DERIVATION_QUEUE_LIMIT),
      )
    }))
  }

  const derivedStates = missingSourceIds.map((sourceId) => applyRuntimePatch(
    createDefaultRuntimeState(sourceId),
    buildRuntimeStateFromQueueItems(sourceId, resolvedQueueItemsBySource.get(sourceId) ?? []),
  ))
  await persistRuntimeStates(derivedStates)

  for (const state of derivedStates) {
    existingStates.set(state.sourceId, state)
  }

  return existingStates
}

export async function updateRssSourceRuntimeState(sourceId: string, patch: RssSourceRuntimeStatePatch) {
  const current = await getRssSourceRuntimeState(sourceId)
  const nextState = applyRuntimePatch(current, patch)
  await persistRuntimeState(nextState)
  return nextState
}
