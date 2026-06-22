import type {
  PostType,
  TargetType,
  TaskCategory,
  TaskConditionType,
  TaskCycleType,
  TaskDefinitionStatus,
  TaskRewardTier,
  UserTaskProgressStatus,
} from "@/db/types"
import type { TaskRewardRange, TieredTaskRewardSettings } from "@/lib/task-reward"

export type {
  TaskCategory,
  TaskConditionType,
  TaskCycleType,
  TaskDefinitionStatus,
  TaskRewardTier,
  UserTaskProgressStatus,
}

export type TaskDefinitionRewardInput = TieredTaskRewardSettings

export interface TaskDefinitionConditionConfig {
  boardIds: string[]
  postTypes: PostType[]
}

export interface TaskDefinitionRecordShape {
  id: string
  code: string
  title: string
  description: string | null
  category: TaskCategory
  cycleType: TaskCycleType
  conditionType: TaskConditionType
  conditionConfigJson: unknown
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
  startsAt: Date | string | null
  endsAt: Date | string | null
  createdById: number | null
  updatedById: number | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface TaskDefinitionInput {
  id?: string
  title: string
  description?: string
  category: TaskCategory
  cycleType: TaskCycleType
  conditionType: TaskConditionType
  conditionConfig?: Partial<TaskDefinitionConditionConfig> | null
  targetCount: number
  rewards: TaskDefinitionRewardInput
  status: TaskDefinitionStatus
  sortOrder: number
  startsAt?: string | null
  endsAt?: string | null
}

export interface NormalizedTaskDefinitionConditionConfig {
  boardIds: string[]
  postTypes: PostType[]
}

export interface TaskDefinitionView {
  id: string
  code: string
  title: string
  description: string | null
  category: TaskCategory
  cycleType: TaskCycleType
  conditionType: TaskConditionType
  conditionConfig: NormalizedTaskDefinitionConditionConfig
  targetCount: number
  rewards: TaskDefinitionRewardInput
  status: TaskDefinitionStatus
  sortOrder: number
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskProgressRewardSnapshot {
  tier: TaskRewardTier
  range: TaskRewardRange
}

export interface TaskProgressSummary {
  progressCount: number
  targetCount: number
  rewardTier: TaskRewardTier
  rewardRange: TaskRewardRange
  settledRewardPoints: number | null
  status: UserTaskProgressStatus
  cycleKey: string
}

export interface TaskCenterCheckInEvent {
  type: "CHECK_IN"
  userId: number
  dateKey: string
}

export interface TaskCenterApprovedPostEvent {
  type: "APPROVED_POST"
  userId: number
  postId: string
  boardId: string
  postType: PostType
}

export interface TaskCenterApprovedCommentEvent {
  type: "APPROVED_COMMENT"
  userId: number
  commentId: string
  postId: string
  boardId: string
}

export interface TaskCenterGivenLikeEvent {
  type: "GIVEN_LIKE"
  userId: number
  targetType: TargetType
  targetId: string
  targetUserId: number | null
}

export interface TaskCenterReceivedLikeEvent {
  type: "RECEIVED_LIKE"
  userId: number
  actorUserId: number
  targetType: TargetType
  targetId: string
}

export interface TaskCenterFavoritePostEvent {
  type: "FAVORITE_POST"
  userId: number
  postId: string
}

export interface TaskCenterFollowBoardEvent {
  type: "FOLLOW_BOARD"
  userId: number
  boardId: string
}

export interface TaskCenterFollowUserEvent {
  type: "FOLLOW_USER"
  userId: number
  targetUserId: number
}

export interface TaskCenterFollowTagEvent {
  type: "FOLLOW_TAG"
  userId: number
  tagId: string
}

export interface TaskCenterFollowPostEvent {
  type: "FOLLOW_POST"
  userId: number
  postId: string
}

export type TaskCenterProgressEvent =
  | TaskCenterCheckInEvent
  | TaskCenterApprovedPostEvent
  | TaskCenterApprovedCommentEvent
  | TaskCenterGivenLikeEvent
  | TaskCenterReceivedLikeEvent
  | TaskCenterFavoritePostEvent
  | TaskCenterFollowBoardEvent
  | TaskCenterFollowUserEvent
  | TaskCenterFollowTagEvent
  | TaskCenterFollowPostEvent
