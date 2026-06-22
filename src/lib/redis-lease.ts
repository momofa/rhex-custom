import { randomUUID } from "crypto"

import { getRedis } from "@/lib/redis"

/**
 * 命名 Lua 命令在 `redis.ts::registerRedisLuaCommands` 中注册（`leaseRelease` / `leaseRenew`）。
 * 走 ioredis 的 EVALSHA 缓存路径：首次 SCRIPT LOAD，之后按 SHA 调用，NOSCRIPT 时自动回退 EVAL，
 * 降低长期 Redis CPU 占用与网络载荷。
 */
type LeaseCommands = {
  leaseRelease: (key: string, token: string) => Promise<number>
  leaseRenew: (key: string, token: string, ttlMs: string) => Promise<number>
}

export interface RedisLease {
  key: string
  token: string
  renew: (ttlMs: number) => Promise<boolean>
  release: () => Promise<boolean>
}

export async function acquireRedisLease(options: {
  key: string
  ttlMs: number
}): Promise<RedisLease | null> {
  const redis = getRedis()
  const commands = redis as unknown as LeaseCommands
  const key = options.key
  const token = randomUUID()
  const ttlMs = Math.max(1, Math.floor(options.ttlMs))
  const result = await redis.set(key, token, "PX", ttlMs, "NX")

  if (result !== "OK") {
    return null
  }

  return {
    key,
    token,
    renew: async (nextTtlMs: number) => {
      const effectiveTtlMs = Math.max(1, Math.floor(nextTtlMs))
      const renewResult = await commands.leaseRenew(key, token, String(effectiveTtlMs))
      return Number(renewResult) === 1
    },
    release: async () => {
      const releaseResult = await commands.leaseRelease(key, token)
      return Number(releaseResult) === 1
    },
  }
}
