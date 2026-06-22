import { findBoardWithZoneBySlug, findPostWithBoardZoneById } from "@/db/board-queries"
import { canUserAccess, resolveBoardSettings } from "@/lib/board-settings"


export async function getBoardAccessContextBySlug(boardSlug: string) {
  const board = await findBoardWithZoneBySlug(boardSlug)


  if (!board) {
    return null
  }

  return {
    board,
    zone: board.zone,
    settings: resolveBoardSettings(board.zone, board),
  }
}

export async function getBoardAccessContextByPostId(postId: string) {
  const post = await findPostWithBoardZoneById(postId)


  if (!post) {
    return null
  }

  return {
    post,
    board: post.board,
    zone: post.board.zone,
    settings: resolveBoardSettings(post.board.zone, post.board),
  }
}

type BoardAccessUser = {
  points: number
  level: number
  role?: "USER" | "MODERATOR" | "ADMIN" | null
  vipLevel?: number | null
  vipExpiresAt?: Date | null
  userBadges?: Array<{ badgeId: string }> | null
  verificationApplications?: Array<{ typeId: string }> | null
}

export function checkBoardPermission(user: BoardAccessUser | null, settings: ReturnType<typeof resolveBoardSettings>, action: "view" | "post" | "reply", pointName?: string | null) {
  return canUserAccess(user ? {
    ...user,
    role: user.role ?? "USER",
    vipLevel: user.vipLevel ?? 0,
    vipExpiresAt: user.vipExpiresAt ?? null,
    grantedBadgeIds: user.userBadges?.map((item) => item.badgeId) ?? [],
    approvedVerificationTypeIds: user.verificationApplications?.map((item) => item.typeId) ?? [],
  } : null, settings, action, pointName)
}


