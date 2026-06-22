import { prisma } from "@/db/client"
import { Prisma, TaskConditionType, TaskDefinitionStatus } from "@/db/types"

export function countTaskDefinitions() {
  return prisma.taskDefinition.count()
}

export function findTaskDefinitionById(id: string) {
  return prisma.taskDefinition.findUnique({
    where: { id },
  })
}

export function findTaskDefinitionByCode(code: string) {
  return prisma.taskDefinition.findUnique({
    where: { code },
  })
}

export function findAdminTaskDefinitions() {
  return prisma.taskDefinition.findMany({
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
  })
}

export function listActiveTaskDefinitionsByConditionType(conditionType: TaskConditionType, now = new Date()) {
  return prisma.taskDefinition.findMany({
    where: {
      conditionType,
      status: TaskDefinitionStatus.ACTIVE,
      OR: [
        { startsAt: null, endsAt: null },
        {
          startsAt: null,
          endsAt: {
            gte: now,
          },
        },
        {
          startsAt: {
            lte: now,
          },
          endsAt: null,
        },
        {
          startsAt: {
            lte: now,
          },
          endsAt: {
            gte: now,
          },
        },
      ],
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  })
}

export function listVisibleTaskDefinitions(now = new Date()) {
  return prisma.taskDefinition.findMany({
    where: {
      status: TaskDefinitionStatus.ACTIVE,
      OR: [
        { startsAt: null, endsAt: null },
        {
          startsAt: null,
          endsAt: {
            gte: now,
          },
        },
        {
          startsAt: {
            lte: now,
          },
          endsAt: null,
        },
        {
          startsAt: {
            lte: now,
          },
          endsAt: {
            gte: now,
          },
        },
      ],
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  })
}

export function createTaskDefinitionRecord(data: Parameters<typeof prisma.taskDefinition.create>[0]["data"]) {
  return prisma.taskDefinition.create({ data })
}

export function createManyTaskDefinitionRecords(data: Prisma.TaskDefinitionCreateManyInput[]) {
  return prisma.taskDefinition.createMany({ data, skipDuplicates: true })
}

export function updateTaskDefinitionRecordById(id: string, data: Parameters<typeof prisma.taskDefinition.update>[0]["data"]) {
  return prisma.taskDefinition.update({
    where: { id },
    data,
  })
}

export function deleteTaskDefinitionRecordById(id: string) {
  return prisma.taskDefinition.delete({
    where: { id },
  })
}

export function findRecentMatchingTaskDefinition(data: {
  title: string
  description: string | null
  category: Prisma.TaskDefinitionCreateInput["category"]
  cycleType: Prisma.TaskDefinitionCreateInput["cycleType"]
  conditionType: Prisma.TaskDefinitionCreateInput["conditionType"]
  conditionConfigJson: Prisma.InputJsonValue
  targetCount: number
  rewardNormalMin: number
  rewardNormalMax: number
  rewardVip1Min: number
  rewardVip1Max: number
  rewardVip2Min: number
  rewardVip2Max: number
  rewardVip3Min: number
  rewardVip3Max: number
  status: TaskDefinitionStatus
  sortOrder: number
  startsAt: Date | null
  endsAt: Date | null
  createdById: number
  createdAfter: Date
}) {
  return prisma.taskDefinition.findFirst({
    where: {
      title: data.title,
      description: data.description,
      category: data.category,
      cycleType: data.cycleType,
      conditionType: data.conditionType,
      conditionConfigJson: {
        equals: data.conditionConfigJson,
      },
      targetCount: data.targetCount,
      rewardNormalMin: data.rewardNormalMin,
      rewardNormalMax: data.rewardNormalMax,
      rewardVip1Min: data.rewardVip1Min,
      rewardVip1Max: data.rewardVip1Max,
      rewardVip2Min: data.rewardVip2Min,
      rewardVip2Max: data.rewardVip2Max,
      rewardVip3Min: data.rewardVip3Min,
      rewardVip3Max: data.rewardVip3Max,
      status: data.status,
      sortOrder: data.sortOrder,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      createdById: data.createdById,
      createdAt: {
        gte: data.createdAfter,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}
