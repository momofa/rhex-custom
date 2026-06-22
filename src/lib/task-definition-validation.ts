import { apiError } from "@/lib/api-route"
import { PostType, TaskCategory, TaskConditionType, TaskCycleType, TaskDefinitionStatus } from "@/db/types"
import { parseTaskRewardRangeInput } from "@/lib/task-reward"
import type {
  NormalizedTaskDefinitionConditionConfig,
  TaskDefinitionInput,
  TaskDefinitionRewardInput,
} from "@/lib/task-center-types"
import { getTaskConditionTemplate } from "@/lib/task-condition-templates"
import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

function normalizeTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeCategory(value: unknown) {
  return value === TaskCategory.NEWBIE || value === TaskCategory.DAILY || value === TaskCategory.CHALLENGE
    ? value
    : null
}

function normalizeCycleType(value: unknown) {
  return value === TaskCycleType.PERMANENT || value === TaskCycleType.DAILY || value === TaskCycleType.WEEKLY
    ? value
    : null
}

function normalizeConditionType(value: unknown) {
  return value === TaskConditionType.CHECK_IN_COUNT
    || value === TaskConditionType.APPROVED_POST_COUNT
    || value === TaskConditionType.APPROVED_COMMENT_COUNT
    || value === TaskConditionType.GIVEN_LIKE_COUNT
    || value === TaskConditionType.RECEIVED_LIKE_COUNT
    || value === TaskConditionType.APPROVED_COMMENT_DISTINCT_POST_COUNT
    || value === TaskConditionType.FAVORITE_POST_COUNT
    || value === TaskConditionType.FOLLOW_BOARD_COUNT
    || value === TaskConditionType.FOLLOW_USER_COUNT
    || value === TaskConditionType.FOLLOW_TAG_COUNT
    || value === TaskConditionType.FOLLOW_POST_COUNT
    ? value
    : null
}

function normalizeStatus(value: unknown) {
  return value === TaskDefinitionStatus.ACTIVE
    || value === TaskDefinitionStatus.PAUSED
    || value === TaskDefinitionStatus.ARCHIVED
    ? value
    : TaskDefinitionStatus.ACTIVE
}

function normalizeDateTime(value: unknown, label: string) {
  const normalized = normalizeTrimmedText(value)
  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    apiError(400, `${label}格式不正确`)
  }

  return parsed.toISOString()
}

function normalizeBoardIds(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(
    value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean),
  ))
}

function normalizePostTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(
    value.filter((item): item is PostType => item === PostType.NORMAL
      || item === PostType.BOUNTY
      || item === PostType.POLL
      || item === PostType.LOTTERY
      || item === PostType.AUCTION),
  ))
}

export function normalizeTaskDefinitionConditionConfig(value: unknown): NormalizedTaskDefinitionConditionConfig {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return {
    boardIds: normalizeBoardIds(record.boardIds),
    postTypes: normalizePostTypes(record.postTypes),
  }
}

function resolveRewardRange(value: unknown, label: string) {
  const parsed = parseTaskRewardRangeInput(value)
  if (!parsed) {
    apiError(400, `${label}格式不正确，支持填写 5 或 5-10`)
  }

  return parsed
}

function normalizeTaskRewards(input: Record<string, unknown>): TaskDefinitionRewardInput {
  return {
    normal: resolveRewardRange(input.rewardNormal, "普通用户奖励"),
    vip1: resolveRewardRange(input.rewardVip1, "VIP1 奖励"),
    vip2: resolveRewardRange(input.rewardVip2, "VIP2 奖励"),
    vip3: resolveRewardRange(input.rewardVip3, "VIP3 奖励"),
  }
}

function normalizeSortOrder(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.max(0, Math.floor(numeric))
}

export function validateTaskDefinitionInput(raw: unknown): TaskDefinitionInput {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}

  const title = normalizeTrimmedText(record.title)
  if (!title) {
    apiError(400, "任务标题不能为空")
  }

  const category = normalizeCategory(record.category)
  if (!category) {
    apiError(400, "任务分类不正确")
  }

  const cycleType = normalizeCycleType(record.cycleType)
  if (!cycleType) {
    apiError(400, "任务周期不正确")
  }

  const conditionType = normalizeConditionType(record.conditionType)
  if (!conditionType) {
    apiError(400, "任务条件模板不正确")
  }

  const template = getTaskConditionTemplate(conditionType)
  if (!template) {
    apiError(400, "当前任务模板暂不可用")
  }

  if (!template.supportedCategories.includes(category)) {
    apiError(400, "当前任务模板不支持该分类")
  }

  if (!template.supportedCycleTypes.includes(cycleType)) {
    apiError(400, "当前任务模板不支持该周期")
  }

  const targetCount = parsePositiveSafeInteger(record.targetCount)
  if (targetCount === null) {
    apiError(400, "目标次数必须为正整数")
  }

  const startsAt = normalizeDateTime(record.startsAt, "开始时间")
  const endsAt = normalizeDateTime(record.endsAt, "结束时间")
  if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
    apiError(400, "开始时间不能晚于结束时间")
  }

  const conditionConfig = normalizeTaskDefinitionConditionConfig(record.conditionConfig)
  if (!template.supportsBoardFilter && conditionConfig.boardIds.length > 0) {
    apiError(400, "当前任务模板不支持节点筛选")
  }

  if (!template.supportsPostTypeFilter && conditionConfig.postTypes.length > 0) {
    apiError(400, "当前任务模板不支持帖子类型筛选")
  }

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id : undefined,
    title,
    description: normalizeTrimmedText(record.description),
    category,
    cycleType,
    conditionType,
    conditionConfig,
    targetCount,
    rewards: normalizeTaskRewards(record),
    status: normalizeStatus(record.status),
    sortOrder: normalizeSortOrder(record.sortOrder),
    startsAt,
    endsAt,
  }
}
