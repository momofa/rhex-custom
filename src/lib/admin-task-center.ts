import { createHash, randomUUID } from "node:crypto"

import { Prisma, TaskDefinitionStatus, PostType, TaskRewardTier, type TaskDefinition } from "@/db/types"
import {
  createTaskDefinitionRecord,
  deleteTaskDefinitionRecordById,
  findAdminTaskDefinitions,
  findRecentMatchingTaskDefinition,
  findTaskDefinitionByCode,
  findTaskDefinitionById,
  updateTaskDefinitionRecordById,
} from "@/db/task-definition-queries"
import { syncOpenUserTaskProgressSnapshotsForTask } from "@/db/task-progress-queries"
import { requireAdminUser } from "@/lib/admin"
import { apiError } from "@/lib/api-route"
import { buildTaskConditionSummary, getTaskCategoryLabel, getTaskCycleTypeLabel } from "@/lib/task-condition-templates"
import { ensureTaskCenterSeeded } from "@/lib/task-center-defaults"
import type { TaskDefinitionInput, TaskDefinitionView } from "@/lib/task-center-types"
import { validateTaskDefinitionInput } from "@/lib/task-definition-validation"
import { formatTaskRewardRange } from "@/lib/task-reward"

function buildTaskCode() {
  return `task_${randomUUID().replace(/-/g, "").slice(0, 16)}`
}

function buildTaskCodeFromRequestId(userId: number, requestId: string) {
  const hash = createHash("sha256")
    .update(`admin-task:${userId}:${requestId}`)
    .digest("hex")
    .slice(0, 24)
  return `task_req_${hash}`
}

function readCreateRequestId(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return ""
  }

  const requestId = (raw as Record<string, unknown>).requestId
  return typeof requestId === "string" && requestId.trim().length >= 8
    ? requestId.trim().slice(0, 128)
    : ""
}

function isTaskCodeUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function formatOptionalDate(value: Date | null) {
  return value ? value.toISOString() : null
}

function mapTaskDefinition(item: TaskDefinition): TaskDefinitionView {
  const conditionConfig = item.conditionConfigJson && typeof item.conditionConfigJson === "object" && !Array.isArray(item.conditionConfigJson)
    ? item.conditionConfigJson as { boardIds?: string[]; postTypes?: string[] }
    : {}

  const normalizedConfig = {
    boardIds: Array.isArray(conditionConfig.boardIds) ? conditionConfig.boardIds.filter((value): value is string => typeof value === "string") : [],
    postTypes: Array.isArray(conditionConfig.postTypes)
      ? conditionConfig.postTypes.filter((value): value is PostType => value === PostType.NORMAL
        || value === PostType.BOUNTY
        || value === PostType.POLL
        || value === PostType.LOTTERY
        || value === PostType.AUCTION)
      : [],
  }

  return {
    id: item.id,
    code: item.code,
    title: item.title,
    description: item.description ?? null,
    category: item.category,
    cycleType: item.cycleType,
    conditionType: item.conditionType,
    conditionConfig: normalizedConfig,
    targetCount: item.targetCount,
    rewards: {
      normal: { min: item.rewardNormalMin, max: item.rewardNormalMax },
      vip1: { min: item.rewardVip1Min, max: item.rewardVip1Max },
      vip2: { min: item.rewardVip2Min, max: item.rewardVip2Max },
      vip3: { min: item.rewardVip3Min, max: item.rewardVip3Max },
    },
    status: item.status,
    sortOrder: item.sortOrder,
    startsAt: formatOptionalDate(item.startsAt),
    endsAt: formatOptionalDate(item.endsAt),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

function buildCreatePayload(input: TaskDefinitionInput, userId: number, code = buildTaskCode()) {
  return {
    code,
    title: input.title,
    description: input.description || null,
    category: input.category,
    cycleType: input.cycleType,
    conditionType: input.conditionType,
    conditionConfigJson: input.conditionConfig ?? {},
    targetCount: input.targetCount,
    rewardNormalMin: input.rewards.normal.min,
    rewardNormalMax: input.rewards.normal.max,
    rewardVip1Min: input.rewards.vip1.min,
    rewardVip1Max: input.rewards.vip1.max,
    rewardVip2Min: input.rewards.vip2.min,
    rewardVip2Max: input.rewards.vip2.max,
    rewardVip3Min: input.rewards.vip3.min,
    rewardVip3Max: input.rewards.vip3.max,
    status: input.status,
    sortOrder: input.sortOrder,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    createdById: userId,
    updatedById: userId,
  }
}

async function syncOpenProgressSnapshots(item: TaskDefinition) {
  await syncOpenUserTaskProgressSnapshotsForTask({
    taskId: item.id,
    categorySnapshot: item.category,
    cycleTypeSnapshot: item.cycleType,
    conditionTypeSnapshot: item.conditionType,
    targetCountSnapshot: item.targetCount,
    rewards: {
      [TaskRewardTier.NORMAL]: { min: item.rewardNormalMin, max: item.rewardNormalMax },
      [TaskRewardTier.VIP1]: { min: item.rewardVip1Min, max: item.rewardVip1Max },
      [TaskRewardTier.VIP2]: { min: item.rewardVip2Min, max: item.rewardVip2Max },
      [TaskRewardTier.VIP3]: { min: item.rewardVip3Min, max: item.rewardVip3Max },
    },
  })
}

export interface AdminTaskItem extends TaskDefinitionView {
  categoryLabel: string
  cycleTypeLabel: string
  conditionSummary: string
  rewardSummary: {
    normal: string
    vip1: string
    vip2: string
    vip3: string
  }
}

function mapAdminTaskItem(item: TaskDefinition): AdminTaskItem {
  const mapped = mapTaskDefinition(item)

  return {
    ...mapped,
    categoryLabel: getTaskCategoryLabel(mapped.category),
    cycleTypeLabel: getTaskCycleTypeLabel(mapped.cycleType),
    conditionSummary: buildTaskConditionSummary({
      conditionType: mapped.conditionType,
      targetCount: mapped.targetCount,
      config: mapped.conditionConfig,
    }),
    rewardSummary: {
      normal: formatTaskRewardRange(mapped.rewards.normal),
      vip1: formatTaskRewardRange(mapped.rewards.vip1),
      vip2: formatTaskRewardRange(mapped.rewards.vip2),
      vip3: formatTaskRewardRange(mapped.rewards.vip3),
    },
  }
}

export async function getAdminTaskList(): Promise<AdminTaskItem[]> {
  const admin = await requireAdminUser("admin.operations.manage")
  if (!admin) {
    apiError(403, "无权访问任务系统")
  }

  await ensureTaskCenterSeeded(admin.id)

  const items = await findAdminTaskDefinitions()
  return items.map(mapAdminTaskItem)
}

export async function saveAdminTaskDefinition(raw: unknown) {
  const admin = await requireAdminUser("admin.operations.manage")
  if (!admin) {
    apiError(403, "无权操作任务系统")
  }

  const input = validateTaskDefinitionInput(raw)
  const existing = input.id ? await findTaskDefinitionById(input.id) : null
  if (input.id && !existing) {
    apiError(404, "任务不存在")
  }

  const createRequestId = input.id ? "" : readCreateRequestId(raw)
  const payload = buildCreatePayload(
    input,
    admin.id,
    createRequestId ? buildTaskCodeFromRequestId(admin.id, createRequestId) : buildTaskCode(),
  )
  if (existing) {
    const updated = await updateTaskDefinitionRecordById(existing.id, {
      ...payload,
      code: existing.code,
      createdById: existing.createdById,
    })
    await syncOpenProgressSnapshots(updated)
    return mapAdminTaskItem(updated)
  }

  const recentDuplicate = await findRecentMatchingTaskDefinition({
    ...payload,
    conditionConfigJson: payload.conditionConfigJson,
    createdById: admin.id,
    createdAfter: new Date(Date.now() - 10_000),
  })
  if (recentDuplicate) {
    return mapAdminTaskItem(recentDuplicate)
  }

  try {
    return mapAdminTaskItem(await createTaskDefinitionRecord(payload))
  } catch (error) {
    if (isTaskCodeUniqueError(error)) {
      const existingByCode = await findTaskDefinitionByCode(payload.code)
      if (existingByCode) {
        return mapAdminTaskItem(existingByCode)
      }
    }

    throw error
  }
}

export async function updateAdminTaskStatus(id: string, status: string) {
  const admin = await requireAdminUser("admin.operations.manage")
  if (!admin) {
    apiError(403, "无权更新任务状态")
  }

  const existing = await findTaskDefinitionById(id)
  if (!existing) {
    apiError(404, "任务不存在")
  }

  const normalizedStatus = status === TaskDefinitionStatus.ACTIVE
    || status === TaskDefinitionStatus.PAUSED
    || status === TaskDefinitionStatus.ARCHIVED
    ? status
    : TaskDefinitionStatus.PAUSED

  return mapAdminTaskItem(await updateTaskDefinitionRecordById(id, {
    status: normalizedStatus,
    updatedById: admin.id,
  }))
}

export async function duplicateAdminTaskDefinition(id: string) {
  const admin = await requireAdminUser("admin.operations.manage")
  if (!admin) {
    apiError(403, "无权复制任务")
  }

  const existing = await findTaskDefinitionById(id)
  if (!existing) {
    apiError(404, "任务不存在")
  }

  return mapAdminTaskItem(await createTaskDefinitionRecord({
    code: buildTaskCode(),
    title: `${existing.title} 副本`,
    description: existing.description,
    category: existing.category,
    cycleType: existing.cycleType,
    conditionType: existing.conditionType,
    conditionConfigJson: existing.conditionConfigJson ?? {},
    targetCount: existing.targetCount,
    rewardNormalMin: existing.rewardNormalMin,
    rewardNormalMax: existing.rewardNormalMax,
    rewardVip1Min: existing.rewardVip1Min,
    rewardVip1Max: existing.rewardVip1Max,
    rewardVip2Min: existing.rewardVip2Min,
    rewardVip2Max: existing.rewardVip2Max,
    rewardVip3Min: existing.rewardVip3Min,
    rewardVip3Max: existing.rewardVip3Max,
    status: TaskDefinitionStatus.PAUSED,
    sortOrder: existing.sortOrder + 1,
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
    createdById: admin.id,
    updatedById: admin.id,
  }))
}

export async function deleteAdminTaskDefinition(id: string) {
  const admin = await requireAdminUser("admin.operations.manage")
  if (!admin) {
    apiError(403, "无权删除任务")
  }

  const existing = await findTaskDefinitionById(id)
  if (!existing) {
    apiError(404, "任务不存在")
  }

  await deleteTaskDefinitionRecordById(id)
  return { id }
}
