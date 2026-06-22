import { getLocalDateKey } from "@/lib/date-key"

export interface CheckInStreakEntry {
  checkedInOn: string
  isMakeUp: boolean
}

export interface CheckInStreakSummary {
  currentStreak: number
  maxStreak: number
  lastCheckInDate: string | null
}

function parseDateKeyParts(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  return { year, month, day }
}

function normalizeDateKey(dateKey: string) {
  const parts = parseDateKeyParts(dateKey)
  if (!parts) {
    return null
  }

  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return Number.isNaN(utcDate.getTime()) ? null : utcDate
}

function shiftDateKey(dateKey: string, deltaDays: number) {
  const normalized = normalizeDateKey(dateKey)
  if (!normalized) {
    return null
  }

  normalized.setUTCDate(normalized.getUTCDate() + deltaDays)
  return getLocalDateKey(normalized, "UTC")
}

export function calculateCheckInStreakSummary(
  entries: CheckInStreakEntry[],
  options: {
    includeMakeUps: boolean
    todayKey?: string
  },
): CheckInStreakSummary {
  const effectiveDates = Array.from(new Set(
    entries
      .filter((entry) => options.includeMakeUps || !entry.isMakeUp)
      .map((entry) => entry.checkedInOn)
      .filter((dateKey) => Boolean(normalizeDateKey(dateKey))),
  )).sort((left, right) => left.localeCompare(right))

  if (effectiveDates.length === 0) {
    return {
      currentStreak: 0,
      maxStreak: 0,
      lastCheckInDate: null,
    }
  }

  let maxStreak = 1
  let runningStreak = 1

  for (let index = 1; index < effectiveDates.length; index += 1) {
    const expectedPreviousDate = shiftDateKey(effectiveDates[index], -1)
    if (expectedPreviousDate && expectedPreviousDate === effectiveDates[index - 1]) {
      runningStreak += 1
      maxStreak = Math.max(maxStreak, runningStreak)
      continue
    }

    runningStreak = 1
  }

  const todayKey = options.todayKey ?? getLocalDateKey()
  const yesterdayKey = shiftDateKey(todayKey, -1)
  const effectiveDateSet = new Set(effectiveDates)
  const streakEndDate = effectiveDateSet.has(todayKey)
    ? todayKey
    : yesterdayKey && effectiveDateSet.has(yesterdayKey)
      ? yesterdayKey
      : null

  if (!streakEndDate) {
    return {
      currentStreak: 0,
      maxStreak,
      lastCheckInDate: effectiveDates.at(-1) ?? null,
    }
  }

  let currentStreak = 0
  let cursor: string | null = streakEndDate
  while (cursor && effectiveDateSet.has(cursor)) {
    currentStreak += 1
    cursor = shiftDateKey(cursor, -1)
  }

  return {
    currentStreak,
    maxStreak,
    lastCheckInDate: effectiveDates.at(-1) ?? null,
  }
}
