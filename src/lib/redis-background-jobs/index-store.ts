type BackgroundJobIndexLocation = "delayed" | "stream" | "dead-letter"

export interface RedisBackgroundJobIndexRecord {
  jobId: string
  location: BackgroundJobIndexLocation
  encodedJob?: string
  entryId?: string
  deadLetterValue?: string
}

export function serializeBackgroundJobIndexRecord(record: RedisBackgroundJobIndexRecord) {
  return JSON.stringify(record)
}

export function parseBackgroundJobIndexRecord(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<RedisBackgroundJobIndexRecord>
    if (!parsed || typeof parsed !== "object" || typeof parsed.jobId !== "string" || typeof parsed.location !== "string") {
      return null
    }

    if (parsed.location !== "delayed" && parsed.location !== "stream" && parsed.location !== "dead-letter") {
      return null
    }

    return {
      jobId: parsed.jobId,
      location: parsed.location,
      encodedJob: typeof parsed.encodedJob === "string" ? parsed.encodedJob : undefined,
      entryId: typeof parsed.entryId === "string" ? parsed.entryId : undefined,
      deadLetterValue: typeof parsed.deadLetterValue === "string" ? parsed.deadLetterValue : undefined,
    } satisfies RedisBackgroundJobIndexRecord
  } catch {
    return null
  }
}