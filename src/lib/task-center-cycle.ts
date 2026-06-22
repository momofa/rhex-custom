import { TaskCycleType } from "@/db/types"
import { BUSINESS_TIME_ZONE, getLocalDateKey } from "@/lib/date-key"

export const PERMANENT_TASK_CYCLE_KEY = "PERMANENT"

function getBusinessDateParts(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
  const parts = formatter.formatToParts(date)
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    weekday: String(partMap.weekday ?? ""),
  }
}

function getWeekdayIndex(weekday: string) {
  switch (weekday) {
    case "Mon":
      return 1
    case "Tue":
      return 2
    case "Wed":
      return 3
    case "Thu":
      return 4
    case "Fri":
      return 5
    case "Sat":
      return 6
    case "Sun":
      return 7
    default:
      return 1
  }
}

function formatDateKeyFromUtc(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function getBusinessWeekKey(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = getBusinessDateParts(date, timeZone)
  const weekdayIndex = getWeekdayIndex(parts.weekday)
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  utcDate.setUTCDate(utcDate.getUTCDate() - (weekdayIndex - 1))

  const weekStartKey = formatDateKeyFromUtc(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate(),
  )

  return `WEEK:${weekStartKey}`
}

export function getTaskCycleKey(cycleType: TaskCycleType, date = new Date()) {
  switch (cycleType) {
    case TaskCycleType.PERMANENT:
      return PERMANENT_TASK_CYCLE_KEY
    case TaskCycleType.WEEKLY:
      return getBusinessWeekKey(date)
    case TaskCycleType.DAILY:
    default:
      return getLocalDateKey(date)
  }
}
