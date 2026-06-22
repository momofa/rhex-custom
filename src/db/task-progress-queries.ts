import {
  TaskRewardTier,
  UserTaskProgressStatus,
  type Prisma,
  type PrismaClient,
  type TaskCategory,
  type TaskConditionType,
  type TaskCycleType,
} from "@prisma/client"

import { prisma } from "@/db/client"

type TaskProgressQueryClient = Prisma.TransactionClient | PrismaClient

function resolveClient(client?: TaskProgressQueryClient) {
  return client ?? prisma
}

export function findUserTaskProgressByKey(params: {
  userId: number
  taskId: string
  cycleKey: string
  client?: TaskProgressQueryClient
}) {
  return resolveClient(params.client).userTaskProgress.findUnique({
    where: {
      userId_taskId_cycleKey: {
        userId: params.userId,
        taskId: params.taskId,
        cycleKey: params.cycleKey,
      },
    },
  })
}

export function createUserTaskProgressRecord(params: {
  data: Prisma.UserTaskProgressUncheckedCreateInput
  client?: TaskProgressQueryClient
}) {
  return resolveClient(params.client).userTaskProgress.create({
    data: params.data,
  })
}

export function updateUserTaskProgressRecordById(params: {
  id: string
  data: Prisma.UserTaskProgressUncheckedUpdateInput
  client?: TaskProgressQueryClient
}) {
  return resolveClient(params.client).userTaskProgress.update({
    where: { id: params.id },
    data: params.data,
  })
}

export async function syncOpenUserTaskProgressSnapshotsForTask(params: {
  taskId: string
  categorySnapshot: TaskCategory
  cycleTypeSnapshot: TaskCycleType
  conditionTypeSnapshot: TaskConditionType
  targetCountSnapshot: number
  rewards: Record<TaskRewardTier, { min: number; max: number }>
  client?: TaskProgressQueryClient
}) {
  const client = resolveClient(params.client)
  const baseData = {
    categorySnapshot: params.categorySnapshot,
    cycleTypeSnapshot: params.cycleTypeSnapshot,
    conditionTypeSnapshot: params.conditionTypeSnapshot,
    targetCountSnapshot: params.targetCountSnapshot,
  }
  const results = await Promise.all(Object.values(TaskRewardTier).map((tier) => client.userTaskProgress.updateMany({
    where: {
      taskId: params.taskId,
      status: UserTaskProgressStatus.IN_PROGRESS,
      rewardTierSnapshot: tier,
    },
    data: {
      ...baseData,
      rewardMinSnapshot: params.rewards[tier].min,
      rewardMaxSnapshot: params.rewards[tier].max,
    },
  })))

  return {
    count: results.reduce((total, result) => total + result.count, 0),
  }
}

export async function createTaskEventLedgerIfAbsent(params: {
  userId: number
  taskId: string
  cycleKey: string
  eventKey: string
  client?: TaskProgressQueryClient
}) {
  const result = await resolveClient(params.client).userTaskEventLedger.createMany({
    data: {
      userId: params.userId,
      taskId: params.taskId,
      cycleKey: params.cycleKey,
      eventKey: params.eventKey,
    },
    skipDuplicates: true,
  })

  return result.count > 0
}

export function listUserTaskProgressesByUserId(params: {
  userId: number
  client?: TaskProgressQueryClient
}) {
  return resolveClient(params.client).userTaskProgress.findMany({
    where: {
      userId: params.userId,
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      task: true,
    },
  })
}
