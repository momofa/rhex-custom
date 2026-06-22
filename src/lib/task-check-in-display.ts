import { revalidateTag, unstable_cache } from "next/cache"

import { countTaskDefinitions, listActiveTaskDefinitionsByConditionType } from "@/db/task-definition-queries"
import { TaskConditionType, TaskCycleType } from "@/db/types"

export const TASK_CHECK_IN_REWARD_CACHE_TAG = "task-check-in-reward"

export interface TaskDrivenCheckInRewardRanges {
  normal: { min: number; max: number }
  vip1: { min: number; max: number }
  vip2: { min: number; max: number }
  vip3: { min: number; max: number }
}

function createEmptyRanges(): TaskDrivenCheckInRewardRanges {
  return {
    normal: { min: 0, max: 0 },
    vip1: { min: 0, max: 0 },
    vip2: { min: 0, max: 0 },
    vip3: { min: 0, max: 0 },
  }
}

async function resolveTaskDrivenCheckInRewardRangesFresh(now = new Date()): Promise<TaskDrivenCheckInRewardRanges | null> {
  const definitionCount = await countTaskDefinitions()
  if (definitionCount === 0) {
    return null
  }

  const tasks = (await listActiveTaskDefinitionsByConditionType(TaskConditionType.CHECK_IN_COUNT, now))
    .filter((task) => task.cycleType === TaskCycleType.DAILY)

  if (tasks.length === 0) {
    return createEmptyRanges()
  }

  return tasks.reduce<TaskDrivenCheckInRewardRanges>((result, task) => ({
    normal: {
      min: result.normal.min + task.rewardNormalMin,
      max: result.normal.max + task.rewardNormalMax,
    },
    vip1: {
      min: result.vip1.min + task.rewardVip1Min,
      max: result.vip1.max + task.rewardVip1Max,
    },
    vip2: {
      min: result.vip2.min + task.rewardVip2Min,
      max: result.vip2.max + task.rewardVip2Max,
    },
    vip3: {
      min: result.vip3.min + task.rewardVip3Min,
      max: result.vip3.max + task.rewardVip3Max,
    },
  }), createEmptyRanges())
}

const getCachedTaskDrivenCheckInRewardRanges = unstable_cache(
  async (todayKey: string): Promise<TaskDrivenCheckInRewardRanges | null> => {
    const todayStart = new Date(`${todayKey}T00:00:00.000+08:00`)
    const now = Number.isNaN(todayStart.getTime()) ? new Date() : todayStart
    return resolveTaskDrivenCheckInRewardRangesFresh(now)
  },
  [TASK_CHECK_IN_REWARD_CACHE_TAG],
  {
    tags: [TASK_CHECK_IN_REWARD_CACHE_TAG],
  },
)

function getLocalDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(date)
}

export async function resolveTaskDrivenCheckInRewardRanges(now = new Date()): Promise<TaskDrivenCheckInRewardRanges | null> {
  try {
    return await getCachedTaskDrivenCheckInRewardRanges(getLocalDateKey(now))
  } catch (error) {
    if (
      error instanceof Error
      && error.message.includes("Invariant: incrementalCache missing in unstable_cache")
    ) {
      return resolveTaskDrivenCheckInRewardRangesFresh(now)
    }

    throw error
  }
}

export function revalidateTaskCheckInRewardCache() {
  try {
    revalidateTag(TASK_CHECK_IN_REWARD_CACHE_TAG, { expire: 0 })
  } catch {
    // Ignore when called by scripts outside a Next.js request context.
  }
}
