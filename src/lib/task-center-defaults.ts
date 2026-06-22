import { randomUUID } from "node:crypto"

import { createManyTaskDefinitionRecords, countTaskDefinitions } from "@/db/task-definition-queries"
import { TaskCategory, TaskConditionType, TaskCycleType, TaskDefinitionStatus } from "@/db/types"
import { findSiteSettingsRecordForUpdate, updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { parseTaskRewardRangeInput } from "@/lib/task-reward"
import { getServerSiteSettings } from "@/lib/site-settings"
import { isRecord, parseAppStateRoot } from "@/lib/site-settings-app-state"
import type { TaskDefinitionInput } from "@/lib/task-center-types"

const TASK_CENTER_STATE_KEY = "taskCenter"

function requireRange(value: unknown, fallback: string) {
  return parseTaskRewardRangeInput(value) ?? parseTaskRewardRangeInput(fallback) ?? { min: 0, max: 0 }
}

export function buildDefaultTaskDefinitionInputs(input: {
  checkInRewardText: string
  checkInVip1RewardText: string
  checkInVip2RewardText: string
  checkInVip3RewardText: string
}): TaskDefinitionInput[] {
  return [
    {
      title: "首次签到",
      description: "完成第一次签到，建立回访节奏。",
      category: TaskCategory.NEWBIE,
      cycleType: TaskCycleType.PERMANENT,
      conditionType: TaskConditionType.CHECK_IN_COUNT,
      targetCount: 1,
      rewards: {
        normal: requireRange(input.checkInRewardText, "5"),
        vip1: requireRange(input.checkInVip1RewardText, "8"),
        vip2: requireRange(input.checkInVip2RewardText, "10"),
        vip3: requireRange(input.checkInVip3RewardText, "12"),
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 10,
    },
    {
      title: "首次发帖",
      description: "发布第一篇公开主题。",
      category: TaskCategory.NEWBIE,
      cycleType: TaskCycleType.PERMANENT,
      conditionType: TaskConditionType.APPROVED_POST_COUNT,
      targetCount: 1,
      rewards: {
        normal: { min: 20, max: 20 },
        vip1: { min: 24, max: 24 },
        vip2: { min: 28, max: 28 },
        vip3: { min: 32, max: 32 },
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 20,
    },
    {
      title: "首次回复",
      description: "完成第一条公开回复。",
      category: TaskCategory.NEWBIE,
      cycleType: TaskCycleType.PERMANENT,
      conditionType: TaskConditionType.APPROVED_COMMENT_COUNT,
      targetCount: 1,
      rewards: {
        normal: { min: 15, max: 15 },
        vip1: { min: 18, max: 18 },
        vip2: { min: 21, max: 21 },
        vip3: { min: 24, max: 24 },
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 30,
    },
    {
      title: "首次点赞",
      description: "第一次给他人的内容点赞。",
      category: TaskCategory.NEWBIE,
      cycleType: TaskCycleType.PERMANENT,
      conditionType: TaskConditionType.GIVEN_LIKE_COUNT,
      targetCount: 1,
      rewards: {
        normal: { min: 5, max: 5 },
        vip1: { min: 6, max: 6 },
        vip2: { min: 7, max: 7 },
        vip3: { min: 8, max: 8 },
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 40,
    },
    {
      title: "每日签到",
      description: "完成当天签到。",
      category: TaskCategory.DAILY,
      cycleType: TaskCycleType.DAILY,
      conditionType: TaskConditionType.CHECK_IN_COUNT,
      targetCount: 1,
      rewards: {
        normal: requireRange(input.checkInRewardText, "5"),
        vip1: requireRange(input.checkInVip1RewardText, "8"),
        vip2: requireRange(input.checkInVip2RewardText, "10"),
        vip3: requireRange(input.checkInVip3RewardText, "12"),
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 110,
    },
    {
      title: "今日回复一次",
      description: "今天完成 1 条公开回复。",
      category: TaskCategory.DAILY,
      cycleType: TaskCycleType.DAILY,
      conditionType: TaskConditionType.APPROVED_COMMENT_COUNT,
      targetCount: 1,
      rewards: {
        normal: { min: 8, max: 8 },
        vip1: { min: 10, max: 10 },
        vip2: { min: 12, max: 12 },
        vip3: { min: 14, max: 14 },
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 120,
    },
    {
      title: "今日点赞三次",
      description: "今天主动点赞 3 次。",
      category: TaskCategory.DAILY,
      cycleType: TaskCycleType.DAILY,
      conditionType: TaskConditionType.GIVEN_LIKE_COUNT,
      targetCount: 3,
      rewards: {
        normal: { min: 4, max: 4 },
        vip1: { min: 5, max: 5 },
        vip2: { min: 6, max: 6 },
        vip3: { min: 7, max: 7 },
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 130,
    },
    {
      title: "本周签到五天",
      description: "本周累计签到 5 天。",
      category: TaskCategory.CHALLENGE,
      cycleType: TaskCycleType.WEEKLY,
      conditionType: TaskConditionType.CHECK_IN_COUNT,
      targetCount: 5,
      rewards: {
        normal: { min: 20, max: 20 },
        vip1: { min: 24, max: 24 },
        vip2: { min: 28, max: 28 },
        vip3: { min: 32, max: 32 },
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 210,
    },
    {
      title: "本周发帖两篇",
      description: "本周公开发帖 2 次。",
      category: TaskCategory.CHALLENGE,
      cycleType: TaskCycleType.WEEKLY,
      conditionType: TaskConditionType.APPROVED_POST_COUNT,
      targetCount: 2,
      rewards: {
        normal: { min: 30, max: 30 },
        vip1: { min: 36, max: 36 },
        vip2: { min: 42, max: 42 },
        vip3: { min: 48, max: 48 },
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 220,
    },
    {
      title: "本周参与五个不同主题",
      description: "本周在 5 个不同主题下完成公开回复。",
      category: TaskCategory.CHALLENGE,
      cycleType: TaskCycleType.WEEKLY,
      conditionType: TaskConditionType.APPROVED_COMMENT_DISTINCT_POST_COUNT,
      targetCount: 5,
      rewards: {
        normal: { min: 25, max: 25 },
        vip1: { min: 30, max: 30 },
        vip2: { min: 35, max: 35 },
        vip3: { min: 40, max: 40 },
      },
      status: TaskDefinitionStatus.ACTIVE,
      sortOrder: 230,
    },
  ]
}

const DEFAULT_TASK_CODES = [
  "task_default_first_check_in",
  "task_default_first_post",
  "task_default_first_reply",
  "task_default_first_like",
  "task_default_daily_check_in",
  "task_default_daily_reply_once",
  "task_default_daily_like_three",
  "task_default_weekly_check_in_five",
  "task_default_weekly_post_two",
  "task_default_weekly_reply_distinct_posts",
] as const

function buildTaskCode(index: number) {
  return DEFAULT_TASK_CODES[index] ?? `task_default_${randomUUID().replace(/-/g, "").slice(0, 16)}`
}

function hasTaskCenterBeenSeeded(appStateJson: string | null | undefined) {
  const root = parseAppStateRoot(appStateJson)
  const taskCenterState = root[TASK_CENTER_STATE_KEY]
  return isRecord(taskCenterState) && taskCenterState.seeded === true
}

function markTaskCenterSeeded(appStateJson: string | null | undefined) {
  const root = parseAppStateRoot(appStateJson)
  const taskCenterState = root[TASK_CENTER_STATE_KEY]
  root[TASK_CENTER_STATE_KEY] = {
    ...(isRecord(taskCenterState) ? taskCenterState : {}),
    seeded: true,
  }
  return JSON.stringify(root)
}

async function markTaskCenterSeededIfNeeded() {
  const settings = await findSiteSettingsRecordForUpdate()
  if (!settings || hasTaskCenterBeenSeeded(settings.appStateJson)) {
    return
  }

  await updateSiteSettingsRecord(settings.id, {
    appStateJson: markTaskCenterSeeded(settings.appStateJson),
  })
}

export async function ensureTaskCenterSeeded(createdById: number | null = null) {
  const existingCount = await countTaskDefinitions()
  if (existingCount > 0) {
    await markTaskCenterSeededIfNeeded()
    return
  }

  const settings = await findSiteSettingsRecordForUpdate()
  if (settings && hasTaskCenterBeenSeeded(settings.appStateJson)) {
    return
  }

  const siteSettings = await getServerSiteSettings()
  const seeds = buildDefaultTaskDefinitionInputs({
    checkInRewardText: siteSettings.checkInRewardText,
    checkInVip1RewardText: siteSettings.checkInVip1RewardText,
    checkInVip2RewardText: siteSettings.checkInVip2RewardText,
    checkInVip3RewardText: siteSettings.checkInVip3RewardText,
  }).map((item, index) => ({
    code: buildTaskCode(index),
    title: item.title,
    description: item.description || null,
    category: item.category,
    cycleType: item.cycleType,
    conditionType: item.conditionType,
    conditionConfigJson: item.conditionConfig ?? {},
    targetCount: item.targetCount,
    rewardNormalMin: item.rewards.normal.min,
    rewardNormalMax: item.rewards.normal.max,
    rewardVip1Min: item.rewards.vip1.min,
    rewardVip1Max: item.rewards.vip1.max,
    rewardVip2Min: item.rewards.vip2.min,
    rewardVip2Max: item.rewards.vip2.max,
    rewardVip3Min: item.rewards.vip3.min,
    rewardVip3Max: item.rewards.vip3.max,
    status: item.status,
    sortOrder: item.sortOrder,
    startsAt: item.startsAt ? new Date(item.startsAt) : null,
    endsAt: item.endsAt ? new Date(item.endsAt) : null,
    createdById,
    updatedById: createdById,
  }))

  await createManyTaskDefinitionRecords(seeds)
  await markTaskCenterSeededIfNeeded()
}
