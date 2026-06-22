import type { TargetType } from "@/db/types"
import type { TaskCenterGivenLikeEvent, TaskCenterReceivedLikeEvent } from "@/lib/task-center-types"

interface BuildLikeTaskEventDescriptorsInput {
  liked: boolean
  actorUserId: number
  targetUserId: number | null
  targetType: TargetType
  targetId: string
}

export type LikeTaskEventDescriptor =
  | {
      kind: "given"
      payload: TaskCenterGivenLikeEvent
    }
  | {
      kind: "received"
      payload: TaskCenterReceivedLikeEvent
    }

export function buildLikeTaskEventDescriptors(
  input: BuildLikeTaskEventDescriptorsInput,
): LikeTaskEventDescriptor[] {
  if (!input.liked) {
    return []
  }

  const descriptors: LikeTaskEventDescriptor[] = [{
    kind: "given",
    payload: {
      type: "GIVEN_LIKE",
      userId: input.actorUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetUserId: input.targetUserId,
    },
  }]

  if (input.targetUserId && input.targetUserId !== input.actorUserId) {
    descriptors.push({
      kind: "received",
      payload: {
        type: "RECEIVED_LIKE",
        userId: input.targetUserId,
        actorUserId: input.actorUserId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    })
  }

  return descriptors
}
