/**
 * Redis 连接事件 metric 与 SLOWLOG 采样（P6 观测面）。
 *
 * 设计目标：
 * - 单点承接 ioredis 的 `connect`/`ready`/`error`/`close`/`end`/`reconnecting`
 *   事件，按 role 维度累计计数 + 记录最近一次错误，便于在 /healthz 类端点读取。
 * - 可插拔 `sink`，默认仅进程内计数；需要对接外部 metric 时在应用启动早期
 *   调用 `configureRedisMetricsSink({...})` 覆盖。
 * - `sampleRedisSlowlog` / `startRedisSlowlogSampler` 按需在 worker 启动阶段
 *   拉起，默认不自动启动，避免对生产既有行为产生副作用。
 *
 * 该模块不引入任何业务语义，纯观测基建；所有调用方应只读 snapshot，
 * 不依赖具体字段类型。
 */

import type Redis from "ioredis"

export type RedisConnectionEvent =
  | "connect"
  | "ready"
  | "error"
  | "close"
  | "end"
  | "reconnecting"

const TRACKED_EVENTS: readonly RedisConnectionEvent[] = [
  "connect",
  "ready",
  "error",
  "close",
  "end",
  "reconnecting",
]

export interface RedisEventRecord {
  role: string
  event: RedisConnectionEvent
  at: number
  errorMessage?: string
}

export interface RedisSlowlogEntry {
  id: number
  /** Redis 服务端秒级时间戳 */
  timestamp: number
  /** 执行耗时（微秒），由 `SLOWLOG GET` 直接返回 */
  durationMicros: number
  /** 命令及参数（按 Redis 配置的截断规则） */
  command: string[]
  clientAddr?: string
  clientName?: string
}

export interface RedisMetricsSink {
  onEvent?(record: RedisEventRecord): void
  onSlowlog?(entries: RedisSlowlogEntry[]): void
}

type CountersByEvent = Partial<Record<RedisConnectionEvent, number>>
type CountersByRole = Record<string, CountersByEvent>

interface MetricsState {
  counters: CountersByRole
  lastEventAt: number
  lastError?: { role: string; message: string; at: number }
  sink: RedisMetricsSink
}

const state: MetricsState = {
  counters: {},
  lastEventAt: 0,
  sink: {},
}

/** 覆盖默认 sink；应在应用启动早期调用，只保留一个 sink。 */
export function configureRedisMetricsSink(sink: RedisMetricsSink): void {
  state.sink = sink ?? {}
}

/**
 * 记录一次 Redis 连接事件。由 `attachRedisMetricsListeners` 内部调用，
 * 也可被业务层直接调用（例如手动 disconnect 前打点）。
 */
export function recordRedisEvent(
  role: string,
  event: RedisConnectionEvent,
  error?: unknown,
): void {
  const roleBucket = state.counters[role] ?? (state.counters[role] = {})
  roleBucket[event] = (roleBucket[event] ?? 0) + 1

  const at = Date.now()
  state.lastEventAt = at

  const message =
    error instanceof Error ? error.message : error != null ? String(error) : undefined

  if (event === "error" && message) {
    state.lastError = { role, message, at }
  }

  // error/reconnecting/end 视为需要运维感知的事件；其余为常态生命周期
  if (event === "error" || event === "reconnecting" || event === "end") {
    const suffix = message ? `: ${message}` : ""
    console.warn(`[redis] ${role} ${event}${suffix}`)
  }

  try {
    state.sink.onEvent?.({ role, event, at, errorMessage: message })
  } catch (sinkError) {
    console.warn("[redis-metrics] sink.onEvent threw", sinkError)
  }
}

export interface RedisMetricsSnapshot {
  counters: CountersByRole
  lastEventAt: number
  lastError?: { role: string; message: string; at: number }
}

export function getRedisMetricsSnapshot(): RedisMetricsSnapshot {
  return {
    counters: cloneCounters(state.counters),
    lastEventAt: state.lastEventAt,
    lastError: state.lastError ? { ...state.lastError } : undefined,
  }
}

function cloneCounters(src: CountersByRole): CountersByRole {
  const out: CountersByRole = {}
  for (const [role, bucket] of Object.entries(src)) {
    out[role] = { ...bucket }
  }
  return out
}

const ATTACHED_SYMBOL = Symbol.for("rhex.redis.metricsAttached")

type MetricsAwareRedis = Redis & { [ATTACHED_SYMBOL]?: boolean }

/**
 * 在给定 ioredis 实例上订阅所有关注的连接事件。幂等：同一 client 重复调用
 * 只会挂一次监听。由 `redis.ts::createRedisClient` / `createRedisConnection`
 * 在创建连接后调用，业务代码通常无需直接使用。
 */
export function attachRedisMetricsListeners(client: Redis, role: string): Redis {
  const marked = client as MetricsAwareRedis
  if (marked[ATTACHED_SYMBOL]) {
    return client
  }
  marked[ATTACHED_SYMBOL] = true

  for (const event of TRACKED_EVENTS) {
    client.on(event, (payload?: unknown) => {
      recordRedisEvent(role, event, event === "error" ? payload : undefined)
    })
  }
  return client
}

/**
 * 主动拉取 Redis SLOWLOG（`SLOWLOG GET <limit>`）并以结构化对象返回。
 * 每次采样后触发 `sink.onSlowlog(entries)`，外部 metric 组件可转推。
 *
 * 注意：SLOWLOG 是 Redis 内部有界队列，调用方应按固定节奏采样并去重（由
 * `entry.id` 单调递增可判重）。
 */
export async function sampleRedisSlowlog(
  client: Redis,
  limit = 10,
): Promise<RedisSlowlogEntry[]> {
  // ioredis 把 `SLOWLOG` 归类为需要 `call` 的命令族，这里用带强类型的代理访问
  const invoker = (client as unknown as {
    call(command: string, ...args: Array<string | number>): Promise<unknown>
  }).call.bind(client)
  const raw = await invoker("SLOWLOG", "GET", limit)
  if (!Array.isArray(raw)) {
    return []
  }

  const entries: RedisSlowlogEntry[] = []
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 4) {
      continue
    }
    const [id, timestamp, durationMicros, command, clientAddr, clientName] = row as [
      unknown,
      unknown,
      unknown,
      unknown,
      unknown?,
      unknown?,
    ]
    entries.push({
      id: Number(id),
      timestamp: Number(timestamp),
      durationMicros: Number(durationMicros),
      command: Array.isArray(command) ? command.map((segment) => String(segment)) : [],
      clientAddr: clientAddr != null ? String(clientAddr) : undefined,
      clientName: clientName != null ? String(clientName) : undefined,
    })
  }

  try {
    state.sink.onSlowlog?.(entries)
  } catch (sinkError) {
    console.warn("[redis-metrics] sink.onSlowlog threw", sinkError)
  }

  return entries
}

export const DEFAULT_SLOWLOG_SAMPLE_INTERVAL_MS = 60_000
const MIN_SLOWLOG_SAMPLE_INTERVAL_MS = 5_000
const MAX_SLOWLOG_SAMPLE_INTERVAL_MS = 600_000

export function getSlowlogSampleIntervalMs(): number {
  const raw = process.env.REDIS_SLOWLOG_SAMPLE_INTERVAL_MS?.trim()
  if (!raw) {
    return DEFAULT_SLOWLOG_SAMPLE_INTERVAL_MS
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SLOWLOG_SAMPLE_INTERVAL_MS
  }
  return Math.min(
    Math.max(parsed, MIN_SLOWLOG_SAMPLE_INTERVAL_MS),
    MAX_SLOWLOG_SAMPLE_INTERVAL_MS,
  )
}

export interface StartSlowlogSamplerOptions {
  intervalMs?: number
  limit?: number
  /** 采样目标连接；返回 null 则跳过本次采样（例如 Redis 未配置） */
  getClient: () => Redis | null
}

let slowlogTimer: NodeJS.Timeout | null = null

/**
 * 拉起 SLOWLOG 采样定时器。幂等：重复调用返回同一停止句柄。
 * 调用方（例如 worker.ts / app 启动流程）决定是否启用。
 */
export function startRedisSlowlogSampler(
  options: StartSlowlogSamplerOptions,
): () => void {
  if (slowlogTimer) {
    return stopRedisSlowlogSampler
  }
  const intervalMs = options.intervalMs ?? getSlowlogSampleIntervalMs()
  const limit = options.limit ?? 10

  const tick = async () => {
    const client = options.getClient()
    if (!client) {
      return
    }
    try {
      await sampleRedisSlowlog(client, limit)
    } catch (error) {
      console.warn("[redis-metrics] slowlog sample failed", error)
    }
  }

  slowlogTimer = setInterval(() => {
    void tick()
  }, intervalMs)
  slowlogTimer.unref?.()
  return stopRedisSlowlogSampler
}

export function stopRedisSlowlogSampler(): void {
  if (slowlogTimer) {
    clearInterval(slowlogTimer)
    slowlogTimer = null
  }
}