import { UserRole, UserStatus } from "@/db/types"

export type RestrictiveUserStatus = Extract<UserStatus, "MUTED" | "BANNED">

const ADMIN_RESTRICTIVE_STATUS_MESSAGES: Record<RestrictiveUserStatus, string> = {
  [UserStatus.MUTED]: "不能禁言管理员账号",
  [UserStatus.BANNED]: "不能封禁管理员账号",
}

export function getBlockedUserStatusChangeMessage(targetUser: { role: UserRole }, nextStatus: RestrictiveUserStatus) {
  if (targetUser.role !== UserRole.ADMIN) {
    return null
  }

  return ADMIN_RESTRICTIVE_STATUS_MESSAGES[nextStatus]
}
