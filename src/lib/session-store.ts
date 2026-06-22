import { getRedis, hasRedisUrl, createRedisKey } from "@/lib/redis"
import { normalizeIp } from "@/lib/request-ip"

export interface PersistedSessionRecord {
  sessionId: string
  username: string
  issuedAt: number
  expiresAt: number
  ip?: string
}

function getSessionRedisKey(sessionId: string) {
  return createRedisKey("session", sessionId)
}

function isPersistedSessionRecord(value: unknown): value is PersistedSessionRecord {
  if (!value || typeof value !== "object") {
    return false
  }

  const record = value as Partial<PersistedSessionRecord>

  return typeof record.sessionId === "string"
    && typeof record.username === "string"
    && typeof record.issuedAt === "number"
    && typeof record.expiresAt === "number"
}

export async function persistSessionRecord(record: PersistedSessionRecord) {

  const ttlSeconds = Math.max(1, record.expiresAt - Math.floor(Date.now() / 1000))
  const normalizedIp = normalizeIp(record.ip ?? null)

  await getRedis().set(
    getSessionRedisKey(record.sessionId),
    JSON.stringify({
      ...record,
      ...(normalizedIp ? { ip: normalizedIp } : {}),
    }),
    "EX",
    ttlSeconds,
  )
}

export async function readPersistedSessionRecord(sessionId: string) {

  const rawRecord = await getRedis().get(getSessionRedisKey(sessionId))

  if (!rawRecord) {
    return null
  }

  try {
    const parsed = JSON.parse(rawRecord) as unknown

    if (!isPersistedSessionRecord(parsed)) {
      return null
    }

    const normalizedIp = normalizeIp(parsed.ip ?? null)

    return {
      sessionId: parsed.sessionId,
      username: parsed.username,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      ...(normalizedIp ? { ip: normalizedIp } : {}),
    }
  } catch {
    return null
  }
}

export async function revokePersistedSession(sessionId: string) {
  if (!hasRedisUrl()) {
    return false
  }

  const deletedCount = await getRedis().del(getSessionRedisKey(sessionId))
  return deletedCount > 0
}
