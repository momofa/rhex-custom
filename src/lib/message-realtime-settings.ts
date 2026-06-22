export const DEFAULT_MESSAGE_REALTIME_ENABLED = true
export const DEFAULT_MESSAGE_REALTIME_HEARTBEAT_SECONDS = 15
export const MIN_MESSAGE_REALTIME_HEARTBEAT_SECONDS = 10
export const MAX_MESSAGE_REALTIME_HEARTBEAT_SECONDS = 120

export function normalizeMessageRealtimeEnabled(value: unknown, fallback = DEFAULT_MESSAGE_REALTIME_ENABLED) {
  return typeof value === "boolean" ? value : fallback
}

export function normalizeMessageRealtimeHeartbeatSeconds(
  value: unknown,
  fallback = DEFAULT_MESSAGE_REALTIME_HEARTBEAT_SECONDS,
) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value.trim())
      : fallback

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(
    MAX_MESSAGE_REALTIME_HEARTBEAT_SECONDS,
    Math.max(MIN_MESSAGE_REALTIME_HEARTBEAT_SECONDS, Math.trunc(parsed)),
  )
}
