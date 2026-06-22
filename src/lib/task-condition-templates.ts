import { PostType, TaskCategory, TaskConditionType, TaskCycleType } from "@/db/types"
import type { NormalizedTaskDefinitionConditionConfig } from "@/lib/task-center-types"

export interface TaskConditionTemplateDefinition {
  type: TaskConditionType
  label: string
  description: string
  supportsBoardFilter: boolean
  supportsPostTypeFilter: boolean
  supportedCategories: readonly TaskCategory[]
  supportedCycleTypes: readonly TaskCycleType[]
  defaultTargetCount: number
}

const ALL_TASK_CATEGORIES = [
  TaskCategory.NEWBIE,
  TaskCategory.DAILY,
  TaskCategory.CHALLENGE,
] as const satisfies readonly TaskCategory[]

const ALL_TASK_CYCLE_TYPES = [
  TaskCycleType.PERMANENT,
  TaskCycleType.DAILY,
  TaskCycleType.WEEKLY,
] as const satisfies readonly TaskCycleType[]

export const TASK_CONDITION_TEMPLATES = [
  {
    type: TaskConditionType.CHECK_IN_COUNT,
    label: "签到次数",
    description: "统计用户完成签到的次数，可用于新手签到、每日签到和周活跃签到。",
    supportsBoardFilter: false,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 1,
  },
  {
    type: TaskConditionType.APPROVED_POST_COUNT,
    label: "审核通过发帖",
    description: "统计审核通过或直接公开的发帖次数。",
    supportsBoardFilter: true,
    supportsPostTypeFilter: true,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 1,
  },
  {
    type: TaskConditionType.APPROVED_COMMENT_COUNT,
    label: "审核通过回复",
    description: "统计审核通过或直接公开的回复次数。",
    supportsBoardFilter: true,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 1,
  },
  {
    type: TaskConditionType.GIVEN_LIKE_COUNT,
    label: "发出点赞",
    description: "统计用户主动发出的点赞次数。",
    supportsBoardFilter: false,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 3,
  },
  {
    type: TaskConditionType.RECEIVED_LIKE_COUNT,
    label: "获得点赞",
    description: "统计用户收到的点赞次数。",
    supportsBoardFilter: false,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 10,
  },
  {
    type: TaskConditionType.APPROVED_COMMENT_DISTINCT_POST_COUNT,
    label: "不同主题回复",
    description: "统计用户在不同主题下完成审核通过回复的主题数。",
    supportsBoardFilter: true,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 5,
  },
  {
    type: TaskConditionType.FAVORITE_POST_COUNT,
    label: "收藏帖子",
    description: "统计用户收藏帖子的次数。",
    supportsBoardFilter: false,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 1,
  },
  {
    type: TaskConditionType.FOLLOW_BOARD_COUNT,
    label: "关注节点",
    description: "统计用户关注节点的次数，可限定在指定节点集合内。",
    supportsBoardFilter: true,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 1,
  },
  {
    type: TaskConditionType.FOLLOW_USER_COUNT,
    label: "关注用户",
    description: "统计用户主动关注其他用户的次数。",
    supportsBoardFilter: false,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 1,
  },
  {
    type: TaskConditionType.FOLLOW_TAG_COUNT,
    label: "关注标签",
    description: "统计用户关注标签的次数。",
    supportsBoardFilter: false,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 1,
  },
  {
    type: TaskConditionType.FOLLOW_POST_COUNT,
    label: "关注帖子",
    description: "统计用户关注帖子的次数。",
    supportsBoardFilter: false,
    supportsPostTypeFilter: false,
    supportedCategories: ALL_TASK_CATEGORIES,
    supportedCycleTypes: ALL_TASK_CYCLE_TYPES,
    defaultTargetCount: 1,
  },
] as const satisfies readonly TaskConditionTemplateDefinition[]

const TASK_CONDITION_TEMPLATE_MAP = new Map<TaskConditionType, TaskConditionTemplateDefinition>(
  TASK_CONDITION_TEMPLATES.map((item) => [item.type, item]),
)

const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  [TaskCategory.NEWBIE]: "新手任务",
  [TaskCategory.DAILY]: "日常任务",
  [TaskCategory.CHALLENGE]: "挑战任务",
}

const TASK_CYCLE_TYPE_LABELS: Record<TaskCycleType, string> = {
  [TaskCycleType.PERMANENT]: "一次性",
  [TaskCycleType.DAILY]: "每日",
  [TaskCycleType.WEEKLY]: "每周",
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  [PostType.NORMAL]: "普通帖",
  [PostType.BOUNTY]: "悬赏帖",
  [PostType.POLL]: "投票帖",
  [PostType.LOTTERY]: "抽奖帖",
  [PostType.AUCTION]: "拍卖帖",
}

export const TASK_POST_TYPE_OPTIONS = [
  { value: PostType.NORMAL, label: POST_TYPE_LABELS[PostType.NORMAL] },
  { value: PostType.BOUNTY, label: POST_TYPE_LABELS[PostType.BOUNTY] },
  { value: PostType.POLL, label: POST_TYPE_LABELS[PostType.POLL] },
  { value: PostType.LOTTERY, label: POST_TYPE_LABELS[PostType.LOTTERY] },
  { value: PostType.AUCTION, label: POST_TYPE_LABELS[PostType.AUCTION] },
] as const

export function getTaskConditionTemplate(type: TaskConditionType) {
  return TASK_CONDITION_TEMPLATE_MAP.get(type) ?? null
}

export function getTaskCategoryLabel(category: TaskCategory) {
  return TASK_CATEGORY_LABELS[category]
}

export function getTaskCycleTypeLabel(cycleType: TaskCycleType) {
  return TASK_CYCLE_TYPE_LABELS[cycleType]
}

export function getTaskPostTypeLabel(postType: PostType) {
  return POST_TYPE_LABELS[postType]
}

export function buildTaskConditionSummary(input: {
  conditionType: TaskConditionType
  targetCount: number
  config: NormalizedTaskDefinitionConditionConfig
}) {
  const boardLabel = input.config.boardIds.length > 0 ? "指定节点内" : "全站"
  const postTypeLabel = input.config.postTypes.length > 0
    ? input.config.postTypes.map((item) => POST_TYPE_LABELS[item]).join(" / ")
    : "全部帖子类型"

  switch (input.conditionType) {
    case TaskConditionType.CHECK_IN_COUNT:
      return `完成签到 ${input.targetCount} 次`
    case TaskConditionType.APPROVED_POST_COUNT:
      return `${boardLabel}发布 ${postTypeLabel}并公开 ${input.targetCount} 次`
    case TaskConditionType.APPROVED_COMMENT_COUNT:
      return `${boardLabel}完成公开回复 ${input.targetCount} 次`
    case TaskConditionType.GIVEN_LIKE_COUNT:
      return `主动点赞 ${input.targetCount} 次`
    case TaskConditionType.RECEIVED_LIKE_COUNT:
      return `获得点赞 ${input.targetCount} 次`
    case TaskConditionType.APPROVED_COMMENT_DISTINCT_POST_COUNT:
      return `${boardLabel}在 ${input.targetCount} 个不同主题下完成公开回复`
    case TaskConditionType.FAVORITE_POST_COUNT:
      return `收藏帖子 ${input.targetCount} 次`
    case TaskConditionType.FOLLOW_BOARD_COUNT:
      return input.config.boardIds.length > 0
        ? `关注指定节点 ${input.targetCount} 个`
        : `关注节点 ${input.targetCount} 个`
    case TaskConditionType.FOLLOW_USER_COUNT:
      return `关注用户 ${input.targetCount} 位`
    case TaskConditionType.FOLLOW_TAG_COUNT:
      return `关注标签 ${input.targetCount} 个`
    case TaskConditionType.FOLLOW_POST_COUNT:
      return `关注帖子 ${input.targetCount} 个`
    default:
      return `完成目标 ${input.targetCount} 次`
  }
}
