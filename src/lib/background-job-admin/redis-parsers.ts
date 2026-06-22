import { type BackgroundJobDeadLetterRecord } from "@/lib/background-jobs"

export type BackgroundJobConnectionKind = "lane" | "transport" | "admin" | "other"

export function parseRedisZRangeWithScores(values: unknown) {
  if (!Array.isArray(values)) {
    return [] as Array<{ member: string; scoreMs: number }>
  }

  const items: Array<{ member: string; scoreMs: number }> = []

  for (let index = 0; index < values.length; index += 2) {
    const member = values[index]
    const scoreRaw = values[index + 1]
    const scoreMs = Number(scoreRaw)

    if (typeof member === "undefined" || !Number.isFinite(scoreMs)) {
      continue
    }

    items.push({
      member: String(member),
      scoreMs,
    })
  }

  return items
}

export function parseRedisClientListEntry(line: string) {
  const fields = new Map<string, string>()

  for (const token of line.split(" ")) {
    const separatorIndex = token.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const key = token.slice(0, separatorIndex)
    const value = token.slice(separatorIndex + 1)
    fields.set(key, value)
  }

  return fields
}

export function resolveBackgroundJobConnectionKind(connectionRole: string): BackgroundJobConnectionKind {
  if (connectionRole.startsWith("background-job:lane:")) {
    return "lane"
  }

  if (connectionRole === "background-job:transport" || connectionRole === "shared") {
    return "transport"
  }

  if (connectionRole.includes("admin")) {
    return "admin"
  }

  return "other"
}

export function parseRedisDeadLetter(value: string): BackgroundJobDeadLetterRecord | null {
  try {
    const parsed = JSON.parse(value) as BackgroundJobDeadLetterRecord
    if (
      !parsed
      || typeof parsed !== "object"
      || !parsed.job
      || typeof parsed.job.name !== "string"
      || typeof parsed.failedAt !== "string"
      || typeof parsed.retryable !== "boolean"
      || !parsed.error
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}