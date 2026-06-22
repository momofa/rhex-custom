import { withDbTransaction } from "@/db/helpers"
import { listActiveTaskDefinitionsByConditionType } from "@/db/task-definition-queries"
import {
  createTaskEventLedgerIfAbsent,
  createUserTaskProgressRecord,
  findUserTaskProgressByKey,
  updateUserTaskProgressRecordById,
} from "@/db/task-progress-queries"
import type {
  AddonTaskDefinitionRecord,
  AddonTaskTriggerType,
  AddonUserTaskProgressRecord,
} from "@/addons-host/types"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { TaskConditionType, UserTaskProgressStatus } from "@/db/types"
import type {
  TaskCenterApprovedCommentEvent,
  TaskCenterApprovedPostEvent,
  TaskCenterCheckInEvent,
  TaskCenterFavoritePostEvent,
  TaskCenterFollowBoardEvent,
  TaskCenterFollowPostEvent,
  TaskCenterFollowTagEvent,
  TaskCenterFollowUserEvent,
  TaskCenterGivenLikeEvent,
  TaskCenterReceivedLikeEvent,
  TaskDefinitionRecordShape,
} from "@/lib/task-center-types"
import { getTaskCycleKey } from "@/lib/task-center-cycle"
import { normalizeTaskDefinitionConditionConfig } from "@/lib/task-definition-validation"
import { ensureTaskCenterSeeded } from "@/lib/task-center-defaults"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getServerSiteSettings } from "@/lib/site-settings"
import { getTaskRewardRangeForTier, resolveUserTaskRewardRange } from "@/lib/task-reward"

interface TaskEventProcessingResult {
  awardedPoints: number
  completedTaskIds: string[]
}

function mapAddonTaskDefinitionRecord(
  task: Awaited<ReturnType<typeof listActiveTaskDefinitionsByConditionType>>[number],
): AddonTaskDefinitionRecord {
  return {
    id: task.id,
    code: task.code,
    title: task.title,
    description: task.description ?? null,
    category: task.category,
    cycleType: task.cycleType,
    conditionType: task.conditionType,
    conditionConfig: task.conditionConfigJson ?? null,
    targetCount: task.targetCount,
    rewardNormalMin: task.rewardNormalMin,
    rewardNormalMax: task.rewardNormalMax,
    rewardVip1Min: task.rewardVip1Min,
    rewardVip1Max: task.rewardVip1Max,
    rewardVip2Min: task.rewardVip2Min,
    rewardVip2Max: task.rewardVip2Max,
    rewardVip3Min: task.rewardVip3Min,
    rewardVip3Max: task.rewardVip3Max,
    status: task.status,
    sortOrder: task.sortOrder,
    startsAt: task.startsAt?.toISOString() ?? null,
    endsAt: task.endsAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

function mapAddonUserTaskProgressRecord(progress: {
  id: string
  userId: number
  taskId: string
  cycleKey: string
  categorySnapshot: string
  cycleTypeSnapshot: string
  conditionTypeSnapshot: string
  targetCountSnapshot: number
  rewardTierSnapshot: string
  rewardMinSnapshot: number
  rewardMaxSnapshot: number
  progressCount: number
  settledRewardPoints: number | null
  status: string
  completedAt: Date | null
  settledAt: Date | null
  metadataJson: unknown
  createdAt: Date
  updatedAt: Date
}): AddonUserTaskProgressRecord {
  return {
    id: progress.id,
    userId: progress.userId,
    taskId: progress.taskId,
    cycleKey: progress.cycleKey,
    categorySnapshot: progress.categorySnapshot as AddonUserTaskProgressRecord["categorySnapshot"],
    cycleTypeSnapshot: progress.cycleTypeSnapshot as AddonUserTaskProgressRecord["cycleTypeSnapshot"],
    conditionTypeSnapshot: progress.conditionTypeSnapshot as AddonUserTaskProgressRecord["conditionTypeSnapshot"],
    targetCountSnapshot: progress.targetCountSnapshot,
    rewardTierSnapshot: progress.rewardTierSnapshot as AddonUserTaskProgressRecord["rewardTierSnapshot"],
    rewardMinSnapshot: progress.rewardMinSnapshot,
    rewardMaxSnapshot: progress.rewardMaxSnapshot,
    progressCount: progress.progressCount,
    settledRewardPoints: progress.settledRewardPoints,
    status: progress.status as AddonUserTaskProgressRecord["status"],
    completedAt: progress.completedAt?.toISOString() ?? null,
    settledAt: progress.settledAt?.toISOString() ?? null,
    metadataJson: progress.metadataJson ?? null,
    createdAt: progress.createdAt.toISOString(),
    updatedAt: progress.updatedAt.toISOString(),
  }
}

function resolveTaskRewardRanges(task: Pick<
  TaskDefinitionRecordShape,
  "rewardNormalMin" | "rewardNormalMax" | "rewardVip1Min" | "rewardVip1Max" | "rewardVip2Min" | "rewardVip2Max" | "rewardVip3Min" | "rewardVip3Max"
>) {
  return {
    normal: { min: task.rewardNormalMin, max: task.rewardNormalMax },
    vip1: { min: task.rewardVip1Min, max: task.rewardVip1Max },
    vip2: { min: task.rewardVip2Min, max: task.rewardVip2Max },
    vip3: { min: task.rewardVip3Min, max: task.rewardVip3Max },
  }
}

function matchesBoardFilter(task: Pick<TaskDefinitionRecordShape, "conditionConfigJson">, boardId: string | null | undefined) {
  const config = normalizeTaskDefinitionConditionConfig(task.conditionConfigJson)
  return config.boardIds.length === 0 || (boardId ? config.boardIds.includes(boardId) : false)
}

function matchesPostTypeFilter(task: Pick<TaskDefinitionRecordShape, "conditionConfigJson">, postType: string | null | undefined) {
  const config = normalizeTaskDefinitionConditionConfig(task.conditionConfigJson)
  return config.postTypes.length === 0 || (postType ? config.postTypes.includes(postType as never) : false)
}

function pickRewardAmount(range: { min: number; max: number }) {
  if (range.min === range.max) {
    return range.min
  }

  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
}

async function settleSingleTaskProgress(params: {
  task: Awaited<ReturnType<typeof listActiveTaskDefinitionsByConditionType>>[number]
  userId: number
  cycleDate?: Date
  eventKey: string
  triggerType: AddonTaskTriggerType
}): Promise<number> {
  const cycleKey = getTaskCycleKey(params.task.cycleType, params.cycleDate)
  const settings = await getServerSiteSettings()

  const completion = await withDbTransaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        points: true,
        vipLevel: true,
        vipExpiresAt: true,
      },
    })

    if (!user) {
      return null
    }

    const existingProgress = await findUserTaskProgressByKey({
      userId: user.id,
      taskId: params.task.id,
      cycleKey,
      client: tx,
    })

    if (existingProgress?.status === UserTaskProgressStatus.COMPLETED) {
      return null
    }

    const eventInserted = await createTaskEventLedgerIfAbsent({
      userId: user.id,
      taskId: params.task.id,
      cycleKey,
      eventKey: params.eventKey,
      client: tx,
    })

    if (!eventInserted) {
      return null
    }

    let progress = existingProgress
    if (!progress) {
      const resolvedReward = resolveUserTaskRewardRange(resolveTaskRewardRanges(params.task), user)
      progress = await createUserTaskProgressRecord({
        client: tx,
        data: {
          userId: user.id,
          taskId: params.task.id,
          cycleKey,
          categorySnapshot: params.task.category,
          cycleTypeSnapshot: params.task.cycleType,
          conditionTypeSnapshot: params.task.conditionType,
          targetCountSnapshot: params.task.targetCount,
          rewardTierSnapshot: resolvedReward.tier,
          rewardMinSnapshot: resolvedReward.range.min,
          rewardMaxSnapshot: resolvedReward.range.max,
          progressCount: 0,
          status: UserTaskProgressStatus.IN_PROGRESS,
          metadataJson: {
            taskCode: params.task.code,
            taskTitle: params.task.title,
          },
        },
      })
    }

    const currentRewardRange = getTaskRewardRangeForTier(
      resolveTaskRewardRanges(params.task),
      progress.rewardTierSnapshot,
    )
    const currentTargetCount = params.task.targetCount
    const nextProgressCount = Math.min(progress.progressCount + 1, currentTargetCount)
    const completedNow = nextProgressCount >= currentTargetCount

    if (!completedNow) {
      await updateUserTaskProgressRecordById({
        id: progress.id,
        client: tx,
        data: {
          categorySnapshot: params.task.category,
          cycleTypeSnapshot: params.task.cycleType,
          conditionTypeSnapshot: params.task.conditionType,
          targetCountSnapshot: currentTargetCount,
          rewardMinSnapshot: currentRewardRange.min,
          rewardMaxSnapshot: currentRewardRange.max,
          progressCount: nextProgressCount,
        },
      })
      return null
    }

    const rewardAmount = pickRewardAmount(currentRewardRange)
    const rewardDelta = await prepareScopedPointDelta({
      scopeKey: "TASK_REWARD",
      baseDelta: rewardAmount,
      userId: user.id,
    })
    const rewardResult = await applyPointDelta({
      tx,
      userId: user.id,
      beforeBalance: user.points,
      prepared: rewardDelta,
      pointName: settings.pointName,
      reason: `完成任务「${params.task.title}」获得${settings.pointName}`,
      eventType: POINT_LOG_EVENT_TYPES.TASK_REWARD,
      eventData: {
        taskId: params.task.id,
        taskCode: params.task.code,
        taskTitle: params.task.title,
        cycleKey,
        rewardTier: progress.rewardTierSnapshot,
      },
    })

    const completedProgress = await updateUserTaskProgressRecordById({
      id: progress.id,
      client: tx,
      data: {
        progressCount: nextProgressCount,
        categorySnapshot: params.task.category,
        cycleTypeSnapshot: params.task.cycleType,
        conditionTypeSnapshot: params.task.conditionType,
        targetCountSnapshot: currentTargetCount,
        rewardMinSnapshot: currentRewardRange.min,
        rewardMaxSnapshot: currentRewardRange.max,
        status: UserTaskProgressStatus.COMPLETED,
        completedAt: new Date(),
        settledAt: new Date(),
        settledRewardPoints: rewardResult.finalDelta,
      },
    })

    return {
      rewardPoints: rewardResult.finalDelta,
      pointName: settings.pointName,
      task: mapAddonTaskDefinitionRecord(params.task),
      progress: mapAddonUserTaskProgressRecord(completedProgress),
    }
  })

  if (!completion) {
    return 0
  }

  await executeAddonActionHook("task.complete.after", {
    userId: params.userId,
    triggerType: params.triggerType,
    eventKey: params.eventKey,
    pointName: completion.pointName,
    rewardPoints: completion.rewardPoints,
    task: completion.task,
    progress: completion.progress,
  })

  return completion.rewardPoints
}

async function processTaskBatch(params: {
  tasks: Awaited<ReturnType<typeof listActiveTaskDefinitionsByConditionType>>
  userId: number
  triggerType: AddonTaskTriggerType
  eventKeyBuilder: (taskId: string) => string
  cycleDate?: Date
}) {
  let awardedPoints = 0
  const completedTaskIds: string[] = []

  for (const task of params.tasks) {
    const rewarded = await settleSingleTaskProgress({
      task,
      userId: params.userId,
      triggerType: params.triggerType,
      cycleDate: params.cycleDate,
      eventKey: params.eventKeyBuilder(task.id),
    })

    if (rewarded > 0) {
      awardedPoints += rewarded
      completedTaskIds.push(task.id)
    }
  }

  return {
    awardedPoints,
    completedTaskIds,
  } satisfies TaskEventProcessingResult
}

export async function recordCheckInTaskEvent(event: TaskCenterCheckInEvent) {
  await ensureTaskCenterSeeded()
  const tasks = await listActiveTaskDefinitionsByConditionType(TaskConditionType.CHECK_IN_COUNT)

  return processTaskBatch({
    tasks,
    userId: event.userId,
    cycleDate: new Date(`${event.dateKey}T00:00:00+08:00`),
    triggerType: event.type,
    eventKeyBuilder: () => `checkin:${event.dateKey}`,
  })
}

export async function recordApprovedPostTaskEvent(event: TaskCenterApprovedPostEvent) {
  await ensureTaskCenterSeeded()
  const tasks = (await listActiveTaskDefinitionsByConditionType(TaskConditionType.APPROVED_POST_COUNT))
    .filter((task) => matchesBoardFilter(task, event.boardId) && matchesPostTypeFilter(task, event.postType))

  return processTaskBatch({
    tasks,
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `post:${event.postId}`,
  })
}

export async function recordApprovedCommentTaskEvent(event: TaskCenterApprovedCommentEvent) {
  await ensureTaskCenterSeeded()
  const [commentCountTasks, distinctPostTasks] = await Promise.all([
    listActiveTaskDefinitionsByConditionType(TaskConditionType.APPROVED_COMMENT_COUNT),
    listActiveTaskDefinitionsByConditionType(TaskConditionType.APPROVED_COMMENT_DISTINCT_POST_COUNT),
  ])

  const commentResult = await processTaskBatch({
    tasks: commentCountTasks.filter((task) => matchesBoardFilter(task, event.boardId)),
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `comment:${event.commentId}`,
  })
  const distinctResult = await processTaskBatch({
    tasks: distinctPostTasks.filter((task) => matchesBoardFilter(task, event.boardId)),
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `post:${event.postId}`,
  })

  return {
    awardedPoints: commentResult.awardedPoints + distinctResult.awardedPoints,
    completedTaskIds: [...commentResult.completedTaskIds, ...distinctResult.completedTaskIds],
  } satisfies TaskEventProcessingResult
}

export async function recordGivenLikeTaskEvent(event: TaskCenterGivenLikeEvent) {
  await ensureTaskCenterSeeded()
  const tasks = await listActiveTaskDefinitionsByConditionType(TaskConditionType.GIVEN_LIKE_COUNT)

  return processTaskBatch({
    tasks,
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `like:${event.targetType}:${event.targetId}`,
  })
}

export async function recordReceivedLikeTaskEvent(event: TaskCenterReceivedLikeEvent) {
  await ensureTaskCenterSeeded()
  const tasks = await listActiveTaskDefinitionsByConditionType(TaskConditionType.RECEIVED_LIKE_COUNT)

  return processTaskBatch({
    tasks,
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `like:${event.actorUserId}:${event.targetType}:${event.targetId}`,
  })
}

export async function recordFavoritePostTaskEvent(event: TaskCenterFavoritePostEvent) {
  await ensureTaskCenterSeeded()
  const tasks = await listActiveTaskDefinitionsByConditionType(TaskConditionType.FAVORITE_POST_COUNT)

  return processTaskBatch({
    tasks,
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `favorite:post:${event.postId}`,
  })
}

export async function recordFollowBoardTaskEvent(event: TaskCenterFollowBoardEvent) {
  await ensureTaskCenterSeeded()
  const tasks = (await listActiveTaskDefinitionsByConditionType(TaskConditionType.FOLLOW_BOARD_COUNT))
    .filter((task) => matchesBoardFilter(task, event.boardId))

  return processTaskBatch({
    tasks,
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `follow:board:${event.boardId}`,
  })
}

export async function recordFollowUserTaskEvent(event: TaskCenterFollowUserEvent) {
  await ensureTaskCenterSeeded()
  const tasks = await listActiveTaskDefinitionsByConditionType(TaskConditionType.FOLLOW_USER_COUNT)

  return processTaskBatch({
    tasks,
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `follow:user:${event.targetUserId}`,
  })
}

export async function recordFollowTagTaskEvent(event: TaskCenterFollowTagEvent) {
  await ensureTaskCenterSeeded()
  const tasks = await listActiveTaskDefinitionsByConditionType(TaskConditionType.FOLLOW_TAG_COUNT)

  return processTaskBatch({
    tasks,
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `follow:tag:${event.tagId}`,
  })
}

export async function recordFollowPostTaskEvent(event: TaskCenterFollowPostEvent) {
  await ensureTaskCenterSeeded()
  const tasks = await listActiveTaskDefinitionsByConditionType(TaskConditionType.FOLLOW_POST_COUNT)

  return processTaskBatch({
    tasks,
    userId: event.userId,
    triggerType: event.type,
    eventKeyBuilder: () => `follow:post:${event.postId}`,
  })
}
