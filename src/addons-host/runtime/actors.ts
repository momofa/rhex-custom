import "server-only"

import { prisma } from "@/db/client"
import { currentUserRecordSelect, type CurrentUserRecord } from "@/db/current-user"

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null
}

export async function resolveAddonActor(input: {
  userId?: number
  username?: string
  label?: string
}): Promise<CurrentUserRecord> {
  const userId = normalizePositiveInteger(input.userId)
  const username = normalizeOptionalString(input.username)
  const label = normalizeOptionalString(input.label) || "actor"

  if (!userId && !username) {
    throw new Error(`${label} 需要提供 userId 或 username`)
  }

  if (userId) {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: currentUserRecordSelect,
    })

    if (actor) {
      return actor
    }
  }

  if (username) {
    const actor = await prisma.user.findUnique({
      where: { username },
      select: currentUserRecordSelect,
    })

    if (actor) {
      return actor
    }
  }

  throw new Error(
    username
      ? `未找到${label} ${username}`
      : `未找到${label} #${userId}`,
  )
}

export function assertAddonActorStatus(
  actor: Pick<CurrentUserRecord, "status">,
  options?: {
    allowMuted?: boolean
    mutedMessage?: string
    bannedMessage?: string
    inactiveMessage?: string
    defaultMessage?: string
  },
) {
  if (actor.status === "ACTIVE") {
    return
  }

  if (actor.status === "MUTED") {
    if (options?.allowMuted) {
      return
    }

    throw new Error(options?.mutedMessage ?? "当前账号已被禁言，暂不可执行该操作")
  }

  if (actor.status === "BANNED") {
    throw new Error(options?.bannedMessage ?? "当前账号已被拉黑，无法执行该操作")
  }

  throw new Error(options?.inactiveMessage ?? options?.defaultMessage ?? "当前账号状态不可执行该操作")
}
