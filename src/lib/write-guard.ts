import { createHash } from "crypto"

import { apiError } from "@/lib/api-route"
import { acquireRedisLease, type RedisLease } from "@/lib/redis-lease"
import { createRedisKey } from "@/lib/redis"
import { logRequestFailed, logRequestStarted, logRequestSucceeded } from "@/lib/request-log"
import { getRequestIp } from "@/lib/request-ip"

export interface WriteGuardIdentity {
  userId?: number | null
  ip?: string | null
}

export interface WriteGuardOptions {
  scope: string
  identity?: WriteGuardIdentity
  cooldownMs?: number
  cooldownMessage?: string
  dedupeKey?: string | null
  dedupeWindowMs?: number
  releaseOnError?: boolean
}



const DEFAULT_COOLDOWN_MS = 3_000
const DEFAULT_DEDUPE_WINDOW_MS = 5_000
const RATE_LIMIT_KIND = "rate"
const DEDUPE_KIND = "dedupe"


function normalizeIdentity(identity?: WriteGuardIdentity) {
  if (identity?.userId) {
    return `user:${identity.userId}`
  }

  if (identity?.ip) {
    return `ip:${identity.ip}`
  }

  return "anonymous"
}

function createStableHash(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

function buildWriteGuardRedisKey(params: {
  scope: string
  identity: string
  kind: string
  fingerprint?: string | null
}) {
  return createRedisKey(
    "write-guard",
    params.kind,
    createStableHash([
      params.scope,
      params.identity,
      params.fingerprint ?? "",
    ].join(":")),
  )
}

async function createWriteGuardLease(params: {
  scope: string
  identity: string
  kind: string
  fingerprint?: string | null
  ttlMs: number
  message: string
}) {
  const lease = await acquireRedisLease({
    key: buildWriteGuardRedisKey(params),
    ttlMs: params.ttlMs,
  })

  if (!lease) {
    apiError(params.kind === RATE_LIMIT_KIND ? 429 : 409, params.message)
  }

  return lease
}

export async function withWriteGuard<T>(options: WriteGuardOptions, task: () => Promise<T>): Promise<T> {
  const identity = normalizeIdentity(options.identity)
  const cooldownMs = Math.max(0, options.cooldownMs ?? DEFAULT_COOLDOWN_MS)
  const dedupeWindowMs = Math.max(0, options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS)
  const createdLeases: RedisLease[] = []

  logRequestStarted({
    scope: options.scope,
    userId: options.identity?.userId ?? null,
  }, {
    identity,
  })

  try {
    if (cooldownMs > 0) {
      const lease = await createWriteGuardLease({
        scope: options.scope,
        identity,
        kind: RATE_LIMIT_KIND,
        ttlMs: cooldownMs,
        message: options.cooldownMessage ?? "操作过于频繁，请稍后再试",
      })
      createdLeases.push(lease)
    }

    if (options.dedupeKey) {
      const lease = await createWriteGuardLease({
        scope: options.scope,
        identity,
        kind: DEDUPE_KIND,
        fingerprint: createStableHash(options.dedupeKey),
        ttlMs: dedupeWindowMs,
        message: "请求重复，请勿重复提交",
      })
      createdLeases.push(lease)
    }

    const result = await task()
    logRequestSucceeded({
      scope: options.scope,
      userId: options.identity?.userId ?? null,
    }, {
      identity,
    })
    return result
  } catch (error) {
    if (options.releaseOnError && createdLeases.length > 0) {
      await Promise.allSettled(createdLeases.map((lease) => lease.release()))
    }

    logRequestFailed({
      scope: options.scope,
      userId: options.identity?.userId ?? null,
    }, error, {
      identity,
    })
    throw error
  }
}


export async function withRequestWriteGuard<T>(options: Omit<WriteGuardOptions, "identity"> & { request: Request; userId?: number | null }, task: () => Promise<T>) {
  return withWriteGuard({
    ...options,
    identity: {
      userId: options.userId ?? null,
      ip: getRequestIp(options.request),
    },
  }, task)
}
