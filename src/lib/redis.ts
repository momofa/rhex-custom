import Redis, { type RedisOptions } from "ioredis"

import { attachRedisMetricsListeners } from "@/lib/redis-metrics"

type GlobalRedisState = {
  redis?: Redis
}

const globalForRedis = globalThis as typeof globalThis & GlobalRedisState

/**
 * 注册 Lua 脚本以便走 EVALSHA 缓存（ioredis 内部自动 SCRIPT LOAD + NOSCRIPT 回退）。
 * 所有业务 Lua 集中于此，确保 getRedis() / duplicate() 得到的连接都能调用命名化命令。
 */
const LEASE_RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`

const LEASE_RENEW_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
end
return 0
`

const POST_VIEW_CLAIM_BATCH_LUA = `
local limit = math.max(1, tonumber(ARGV[1]) or 1)
local moved = {}
local movedCount = 0
local cursor = "0"

repeat
  local page = redis.call("hscan", KEYS[1], cursor, "COUNT", limit)
  cursor = page[1]
  local values = page[2]
  for i = 1, #values, 2 do
    if movedCount >= limit then
      break
    end
    redis.call("hset", KEYS[2], values[i], values[i + 1])
    redis.call("hdel", KEYS[1], values[i])
    table.insert(moved, values[i])
    table.insert(moved, values[i + 1])
    movedCount = movedCount + 1
  end
until movedCount >= limit or cursor == "0"

return moved
`

const POST_VIEW_RESTORE_BATCH_LUA = `
local values = redis.call("hgetall", KEYS[2])
for i = 1, #values, 2 do
  redis.call("hincrby", KEYS[1], values[i], values[i + 1])
end
redis.call("del", KEYS[2])
return #values / 2
`

const RSS_QUEUE_CLAIM_PENDING_LUA = `
local itemsKey = KEYS[1]
local pendingStatusKey = KEYS[2]
local processingStatusKey = KEYS[3]
local recordId = ARGV[1]
local workerId = ARGV[2]
local startedAt = ARGV[3]
local score = ARGV[4]

local currentValue = redis.call("HGET", itemsKey, recordId)
if not currentValue then
  return nil
end

local ok, record = pcall(cjson.decode, currentValue)
if not ok or type(record) ~= "table" or record.status ~= "PENDING" then
  return nil
end

record.backgroundJobId = cjson.null
record.status = "PROCESSING"
record.startedAt = startedAt
record.attemptCount = (tonumber(record.attemptCount) or 0) + 1
record.workerId = workerId
record.leaseExpiresAt = cjson.null
record.updatedAt = startedAt

local nextValue = cjson.encode(record)
redis.call("HSET", itemsKey, recordId, nextValue)
redis.call("ZREM", pendingStatusKey, recordId)
redis.call("ZADD", processingStatusKey, score, recordId)

return nextValue
`

const BACKGROUND_JOB_ENQUEUE_DELAYED_LUA = `
redis.call("ZADD", KEYS[1], ARGV[1], ARGV[3])
redis.call("HSET", KEYS[2], ARGV[2], cjson.encode({
  jobId = ARGV[2],
  location = "delayed",
  encodedJob = ARGV[3],
}))
return 1
`

const BACKGROUND_JOB_PUSH_TO_STREAM_LUA = `
local entryId = redis.call("XADD", KEYS[1], "MAXLEN", "~", ARGV[3], "*", "job", ARGV[2])
redis.call("HSET", KEYS[2], ARGV[1], cjson.encode({
  jobId = ARGV[1],
  location = "stream",
  entryId = entryId,
}))
return entryId
`

const BACKGROUND_JOB_PROMOTE_DUE_DELAYED_LUA = `
local delayedKey = KEYS[1]
local streamKey = KEYS[2]
local indexKey = KEYS[3]
local now = ARGV[1]
local limit = tonumber(ARGV[2])
local maxlen = ARGV[3]

local jobs = redis.call("ZRANGEBYSCORE", delayedKey, "-inf", now, "LIMIT", 0, limit)

for _, job in ipairs(jobs) do
  redis.call("ZREM", delayedKey, job)
  local entryId = redis.call("XADD", streamKey, "MAXLEN", "~", maxlen, "*", "job", job)
  local ok, decoded = pcall(cjson.decode, job)
  if ok and type(decoded) == "table" and type(decoded.id) == "string" then
    redis.call("HSET", indexKey, decoded.id, cjson.encode({
      jobId = decoded.id,
      location = "stream",
      entryId = entryId,
    }))
  end
end

return #jobs
`

const AI_DAILY_INCR_WITH_EXPIRE_LUA = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`

const REGISTERED_LUA_SYMBOL = Symbol.for("rhex.redis.luaRegistered")

type LuaAwareRedis = Redis & { [REGISTERED_LUA_SYMBOL]?: boolean }

function registerRedisLuaCommands(client: Redis): Redis {
  const marked = client as LuaAwareRedis
  if (marked[REGISTERED_LUA_SYMBOL]) {
    return client
  }
  marked[REGISTERED_LUA_SYMBOL] = true
  client.defineCommand("leaseRelease", { numberOfKeys: 1, lua: LEASE_RELEASE_LUA })
  client.defineCommand("leaseRenew", { numberOfKeys: 1, lua: LEASE_RENEW_LUA })
  client.defineCommand("postViewClaimBatch", { numberOfKeys: 2, lua: POST_VIEW_CLAIM_BATCH_LUA })
  client.defineCommand("postViewRestoreBatch", { numberOfKeys: 2, lua: POST_VIEW_RESTORE_BATCH_LUA })
  client.defineCommand("rssQueueClaimPending", { numberOfKeys: 3, lua: RSS_QUEUE_CLAIM_PENDING_LUA })
  client.defineCommand("backgroundJobEnqueueDelayed", { numberOfKeys: 2, lua: BACKGROUND_JOB_ENQUEUE_DELAYED_LUA })
  client.defineCommand("backgroundJobPushToStream", { numberOfKeys: 2, lua: BACKGROUND_JOB_PUSH_TO_STREAM_LUA })
  client.defineCommand("backgroundJobPromoteDueDelayed", { numberOfKeys: 3, lua: BACKGROUND_JOB_PROMOTE_DUE_DELAYED_LUA })
  client.defineCommand("aiDailyIncrWithExpire", { numberOfKeys: 1, lua: AI_DAILY_INCR_WITH_EXPIRE_LUA })
  return client
}

export function hasRedisUrl() {
  return Boolean(process.env.REDIS_URL?.trim())
}

function readRedisUrl() {
  const url = process.env.REDIS_URL?.trim()

  if (!url) {
    throw new Error("缺少 REDIS_URL 环境变量，无法连接 Redis")
  }

  return url
}

function readOptionalRedisEnv(key: string) {
  const value = process.env[key]
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  return trimmed
}

function readRedisDatabase() {
  const raw = readOptionalRedisEnv("REDIS_DB")
  if (raw === undefined) {
    return undefined
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`REDIS_DB 必须是非负整数，当前值：${raw}`)
  }

  const db = Number(raw)
  if (!Number.isSafeInteger(db)) {
    throw new Error(`REDIS_DB 超出安全整数范围，当前值：${raw}`)
  }

  return db
}

function detectRedisProcessRole() {
  const entrypoint = process.argv[1]?.replace(/\\/g, "/").toLowerCase() ?? ""

  if (entrypoint.includes("/worker.ts")) {
    return "worker"
  }

  if (entrypoint.includes("next")) {
    return "web"
  }

  return process.env.NODE_ENV === "production" ? "app" : "dev"
}

function buildRedisConnectionName(role: string) {
  const prefix = process.env.REDIS_CLIENT_NAME_PREFIX?.trim() || "rhex"
  const processRole = detectRedisProcessRole()

  return [prefix, processRole, String(process.pid), role].join(":")
}

export function buildRedisConnectionOptions(role: string): RedisOptions {
  const options: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableAutoPipelining: true,
    connectionName: buildRedisConnectionName(role),
  }
  const username = readOptionalRedisEnv("REDIS_USERNAME")
  const password = readOptionalRedisEnv("REDIS_PASSWORD")
  const db = readRedisDatabase()

  if (username) {
    options.username = username
  }

  if (password !== undefined) {
    options.password = password
  }

  if (db !== undefined) {
    options.db = db
  }

  return options
}

function createRedisClient(role = "shared") {
  const client = new Redis(readRedisUrl(), buildRedisConnectionOptions(role))

  attachRedisMetricsListeners(client, role)
  registerRedisLuaCommands(client)

  return client
}

export function getRedis() {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedisClient("shared")
  }

  return globalForRedis.redis
}

export function createRedisConnection(role = "duplicate") {
  const client = getRedis().duplicate({
    connectionName: buildRedisConnectionName(role),
  })
  attachRedisMetricsListeners(client, role)
  registerRedisLuaCommands(client)
  return client
}

export async function connectRedisClient(client: Redis) {
  if (client.status === "ready") {
    return client
  }

  try {
    await client.connect()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!message.includes("already connecting") && !message.includes("already connected")) {
      throw error
    }
  }

  return client
}

export type WithRedisOptions = {
  /**
   * 若为 true，则创建独立 duplicate 连接，并在 handler 完成后 disconnect。
   * 仅用于阻塞命令（XREADGROUP BLOCK）或订阅（SUBSCRIBE）等必须独占连接的场景。
   * 默认 false，复用进程级共享连接 getRedis()，避免频繁握手。
   */
  fresh?: boolean
}

/**
 * 在共享连接上执行一次 Redis 操作。默认复用 getRedis() 共享连接，不做 disconnect。
 * 若 options.fresh=true，则创建独立 duplicate 并在完成后 disconnect（用于阻塞命令）。
 *
 * @param role 连接角色标签（仅在 fresh 模式用于 connectionName，便于 CLIENT LIST 排查）
 */
export async function withRedis<T>(
  role: string,
  handler: (redis: Redis) => Promise<T>,
  options: WithRedisOptions = {},
): Promise<T> {
  if (options.fresh) {
    const client = createRedisConnection(role)
    try {
      await connectRedisClient(client)
      return await handler(client)
    } finally {
      client.disconnect()
    }
  }

  const client = getRedis()
  await connectRedisClient(client)
  return handler(client)
}

export function createRedisKey(...parts: Array<string | number>) {
  const prefix = process.env.REDIS_KEY_PREFIX?.trim() || "rhex"

  return [prefix, ...parts.map((part) => String(part))].join(":")
}
