import "server-only"

import { toggleFollowTarget } from "@/db/follow-queries"
import { enqueueUserFollowedNotification } from "@/lib/follow-notifications"
import { getUserDisplayName } from "@/lib/user-display"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { ensureUsersCanInteract } from "@/lib/user-blocks"
import { assertAddonActorStatus, resolveAddonActor } from "@/addons-host/runtime/actors"
import type {
  AddonUserFollowInput,
  AddonUserFollowResult,
  LoadedAddonRuntime,
} from "@/addons-host/types"

export async function followAddonUser(
  addon: LoadedAddonRuntime,
  input: AddonUserFollowInput,
): Promise<AddonUserFollowResult> {
  const follower = await resolveAddonActor({
    userId: input.followerId,
    username: input.followerUsername,
    label: "关注发起账号",
  })
  const targetUser = await resolveAddonActor({
    userId: input.targetUserId,
    username: input.targetUsername,
    label: "关注目标账号",
  })

  assertAddonActorStatus(follower, {
    allowMuted: true,
    bannedMessage: "账号已被拉黑，无法关注用户",
    inactiveMessage: "账号未激活，无法关注用户",
  })

  if (follower.id === targetUser.id) {
    throw new Error("不能关注自己")
  }

  await ensureUsersCanInteract({
    actorId: follower.id,
    targetUserId: targetUser.id,
    blockedMessage: "你已拉黑该用户，无法继续关注",
    blockedByMessage: "对方已将你拉黑，无法关注",
  })

  const result = await toggleFollowTarget({
    userId: follower.id,
    targetType: "user",
    targetId: String(targetUser.id),
    desiredFollowed: true,
  })

  if (result.status !== "ok" || !result.followed) {
    throw new Error(`插件 ${addon.manifest.id} 关注用户失败`)
  }

  if (result.changed) {
    await enqueueUserFollowedNotification({
      userId: targetUser.id,
      followerUserId: follower.id,
      followerName: getUserDisplayName(follower),
    })
    revalidateUserSurfaceCache(targetUser.id)
  }

  return {
    targetType: "user",
    targetUserId: targetUser.id,
    followed: true,
    changed: result.changed,
  }
}
