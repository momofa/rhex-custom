import { type BackgroundJobExecutionLogRecord } from "@/lib/background-job-log-store"
import { serializeDateTime } from "@/lib/formatters"

export type UnknownRecord = Record<string, unknown>

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export function normalizeRequestedWorkerLogPage(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.trunc(value))
}

export function buildPagination(
  total: number,
  requestedPage: number,
  pageSize: number,
): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

export function serializeOptionalDateTime(input: Date | string | null | undefined) {
  if (!input) {
    return null
  }

  return serializeDateTime(input) ?? (input instanceof Date ? input.toISOString() : input)
}

export function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function readFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function formatDurationMs(value: number | null) {
  if (value === null) {
    return null
  }

  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}s`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}s`
  }

  return `${Math.round(value)}ms`
}

export function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

export function stringifyJsonPreview(value: unknown, maxLength = 480) {
  try {
    const serialized = JSON.stringify(value, null, 2)
    return truncateText(serialized ?? String(value), maxLength)
  } catch {
    return truncateText(String(value), maxLength)
  }
}

export function summarizePrimitiveValue(value: unknown) {
  if (typeof value === "string") {
    return truncateText(value, 36)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `${value.length} items`
  }

  return null
}

export function summarizeBackgroundJobPayload(payload: unknown) {
  if (!isUnknownRecord(payload)) {
    return summarizePrimitiveValue(payload) ?? "无负载"
  }

  if (typeof payload.auctionId === "string") {
    return `auctionId ${payload.auctionId}`
  }

  if (typeof payload.taskId === "string") {
    return `taskId ${payload.taskId}`
  }

  if (typeof payload.addonId === "string" && typeof payload.jobKey === "string") {
    return `addon ${payload.addonId} · job ${payload.jobKey}`
  }

  if (typeof payload.postId === "string") {
    return `postId ${payload.postId}`
  }

  if (typeof payload.commentId === "string") {
    return `commentId ${payload.commentId}`
  }

  if (typeof payload.userId === "number") {
    return `userId ${payload.userId}`
  }

  if (Array.isArray(payload.notifications)) {
    return `${payload.notifications.length} 条通知`
  }

  const fragments = Object.entries(payload)
    .flatMap(([key, value]) => {
      const summary = summarizePrimitiveValue(value)
      return summary ? [`${key}=${summary}`] : []
    })
    .slice(0, 3)

  if (fragments.length > 0) {
    return fragments.join(" · ")
  }

  const keys = Object.keys(payload)
  return keys.length > 0 ? `${keys.length} 个字段` : "空负载"
}

export function summarizeExecutionLog(record: BackgroundJobExecutionLogRecord) {
  const metadata = record.metadata ?? null
  const extra = record.extra ?? null
  const durationText = formatDurationMs(readFiniteNumber(metadata?.durationMs ?? extra?.durationMs))

  switch (record.action) {
    case "start":
      return "开始执行任务"
    case "success":
      return durationText ? `任务执行完成，耗时 ${durationText}` : "任务执行完成"
    case "retry": {
      const nextAttempt = readFiniteNumber(metadata?.nextAttempt)
      const availableAt = typeof metadata?.availableAt === "string"
        ? serializeOptionalDateTime(metadata.availableAt) ?? metadata.availableAt
        : null
      return nextAttempt !== null
        ? `执行失败，已安排第 ${nextAttempt} 次重试${availableAt ? `，计划于 ${availableAt}` : ""}`
        : "执行失败，已安排重试"
    }
    case "dead-letter":
      return "任务执行失败，已进入死信队列"
    case "run":
      return "任务执行失败"
    case "decode":
      return "任务解码失败，已直接确认"
    case "promote-delayed": {
      const promoted = readFiniteNumber(metadata?.promoted)
      return promoted !== null ? `提升 ${promoted} 个到期延迟任务` : "执行了延迟任务提升"
    }
    case "worker-start": {
      const concurrency = readFiniteNumber(metadata?.concurrency)
      return concurrency !== null ? `worker 启动，并发 ${concurrency}` : "worker 已启动"
    }
    case "worker-lane-restart": {
      const restartDelayMs = readFiniteNumber(metadata?.restartDelayMs)
      return restartDelayMs !== null ? `lane 异常，${formatDurationMs(restartDelayMs)} 后重启` : "lane 异常后重启"
    }
    case "worker-lane":
      return "worker lane 运行异常"
    case "stale-claim-compat":
      return "切换为 XPENDING + XCLAIM 兼容模式"
    default:
      return record.action ?? "worker 事件"
  }
}