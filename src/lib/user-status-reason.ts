export function getDefaultUserStatusReason(status: string | null | undefined) {
  if (status === "BANNED") {
    return "因违反社区规范被管理员公开列入拉黑名单。"
  }

  if (status === "MUTED") {
    return "因违反社区规范被管理员禁言。"
  }

  return ""
}

export function resolveUserStatusReason(status: string | null | undefined, reason?: string | null) {
  return reason?.trim() || getDefaultUserStatusReason(status)
}
