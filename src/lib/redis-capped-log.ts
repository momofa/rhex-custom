/**
 * 日志 ZSET 的近似修剪工具：为 `background-job-log-store` / `rss-harvest-log-store`
 * 等基于 `ZADD + ZREMRANGEBYSCORE + EXPIRE` 的日志存储提供统一的「时间窗 + 数量硬顶」修剪语义，
 * 等价于 Redis Stream 的 `XADD ... MAXLEN ~ N`（近似修剪）。
 *
 * 设计要点：
 * - 单一 helper 管理 3 条命令：`ZREMRANGEBYSCORE`（滑动时间窗）+ `ZREMRANGEBYRANK`（数量硬顶）+ `EXPIRE`（Key 级 TTL 兜底）
 * - 以链式调用接入 `multi()` / `pipeline()`，和业务的 `ZADD` 合并成一次 RTT，保证原子性
 * - 所有阈值走统一环境变量，新增 log store 只需填入 `retentionMs` + `expireSeconds` 即可复用
 */

import type { ChainableCommander } from "ioredis"

import { getRedis } from "@/lib/redis"

export const DEFAULT_LOG_STORE_MAX_ENTRIES = 10_000

const MIN_LOG_STORE_MAX_ENTRIES = 100
const MAX_LOG_STORE_MAX_ENTRIES = 1_000_000

/**
 * 读取日志 ZSET 的数量硬顶。用环境变量 `LOG_STORE_MAX_ENTRIES` 覆盖，默认 10_000。
 * 超范围时 clamp 到 [100, 1_000_000] 区间，保证最差情况下也不会无上限膨胀。
 */
export function getLogStoreMaxEntries(): number {
  const raw = process.env.LOG_STORE_MAX_ENTRIES?.trim()
  if (!raw) {
    return DEFAULT_LOG_STORE_MAX_ENTRIES
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LOG_STORE_MAX_ENTRIES
  }

  return Math.min(Math.max(parsed, MIN_LOG_STORE_MAX_ENTRIES), MAX_LOG_STORE_MAX_ENTRIES)
}

export interface CappedLogPruneOptions {
  /** 当前时刻毫秒（通常复用业务侧 `Date.now()`，避免 helper 内重复取时引入时间戳不一致） */
  nowMs: number
  /** 滑动时间窗保留时长（毫秒），score < nowMs - retentionMs 的条目会被移除 */
  retentionMs: number
  /** 数量硬顶，仅保留最新 N 条；= 0 或负数时跳过数量修剪（保底防御） */
  maxEntries: number
  /** Key 级 TTL（秒），兜底防止无写入后 Key 永久悬挂；= 0 或负数时跳过 EXPIRE */
  expireSeconds: number
}

/**
 * 把「时间窗 + 数量硬顶 + EXPIRE」三条命令追加到已有的 pipeline/multi 链，
 * 供业务在同一次 RTT 内与 `ZADD` 合并提交。
 *
 * 返回同一链对象，支持继续链式追加。
 */
export function queueCappedLogPrune(
  chain: ChainableCommander,
  key: string,
  { nowMs, retentionMs, maxEntries, expireSeconds }: CappedLogPruneOptions,
): ChainableCommander {
  chain.zremrangebyscore(key, "-inf", String(nowMs - retentionMs))

  if (maxEntries > 0) {
    // 保留最新 maxEntries 条：ZSET 按 score 升序，从 rank=0 开始删除最老的
    // 多余元素；`-maxEntries - 1` 表示「倒数第 maxEntries+1 名」即删除边界。
    chain.zremrangebyrank(key, 0, -maxEntries - 1)
  }

  if (expireSeconds > 0) {
    chain.expire(key, expireSeconds)
  }

  return chain
}

/**
 * 独立地对指定 Key 执行一次修剪（不携带 ZADD）。用于读路径的 lazy-prune：
 * 查询面板/列表接口打开时顺手保证一致性，无需依赖写入触发。
 *
 * 返回时间窗修剪删除的条目数（仅供 debug，数量硬顶的删除数不在返回值中）。
 */
export async function pruneCappedLog(
  redis: ReturnType<typeof getRedis>,
  key: string,
  options: CappedLogPruneOptions,
): Promise<number> {
  const pipeline = redis.multi()
  queueCappedLogPrune(pipeline, key, options)
  const results = await pipeline.exec()
  const first = results?.[0]
  if (!first || first[0]) {
    return 0
  }
  return Number(first[1] ?? 0)
}