import { processInBatches } from "@/lib/async-batch"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { findAllUserIdsForLevelRefresh, findUserLevelProgressByUserId, syncUserCheckInProgress } from "@/db/level-system-queries"
import { listUserCheckInStreakEntries } from "@/db/check-in-queries"
import { calculateCheckInStreakSummary } from "@/lib/check-in-streak"
import { getLocalDateKey } from "@/lib/date-key"
import { getSiteSettings } from "@/lib/site-settings"

function hasPersistedCheckInStreakSummary(progress: Awaited<ReturnType<typeof findUserLevelProgressByUserId>>) {
  if (!progress) {
    return false
  }

  if (progress.checkInDays === 0) {
    return true
  }

  return progress.maxCheckInStreak > 0 || progress.lastCheckInDate !== null
}

export async function refreshUserCheckInStreakSummary(userId: number, includeMakeUps: boolean) {
  const entries = await listUserCheckInStreakEntries(userId)
  const summary = calculateCheckInStreakSummary(entries, {
    includeMakeUps,
    todayKey: getLocalDateKey(),
  })

  await syncUserCheckInProgress(userId, {
    checkInDays: entries.length,
    currentCheckInStreak: summary.currentStreak,
    maxCheckInStreak: summary.maxStreak,
    lastCheckInDate: summary.lastCheckInDate,
  })

  return summary
}

export async function getUserCheckInStreakSummary(userId: number) {
  const [settings, progress] = await Promise.all([
    getSiteSettings(),
    findUserLevelProgressByUserId(userId),
  ])

  const summary = hasPersistedCheckInStreakSummary(progress)
    ? {
        currentStreak: progress?.currentCheckInStreak ?? 0,
        maxStreak: progress?.maxCheckInStreak ?? 0,
        lastCheckInDate: progress?.lastCheckInDate ?? null,
      }
    : await refreshUserCheckInStreakSummary(userId, settings.checkInMakeUpCountsTowardStreak)

  return {
    ...summary,
    makeUpCountsTowardStreak: settings.checkInMakeUpCountsTowardStreak,
  }
}

export async function refreshAllUserCheckInStreakSummaries(includeMakeUps: boolean) {
  const users = await findAllUserIdsForLevelRefresh()
  await processInBatches(users, 100, async (user) => {
    await refreshUserCheckInStreakSummary(user.id, includeMakeUps)
  })
}

registerBackgroundJobHandler("check-in.refresh-all-streaks", async (payload) => {
  await refreshAllUserCheckInStreakSummaries(payload.includeMakeUps)
})

export function enqueueRefreshAllUserCheckInStreakSummaries(includeMakeUps: boolean) {
  return enqueueBackgroundJob("check-in.refresh-all-streaks", { includeMakeUps })
}
