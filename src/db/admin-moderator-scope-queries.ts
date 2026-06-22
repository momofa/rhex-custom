import { UserRole } from "@/db/types"
import { prisma } from "@/db/client"

export interface ModeratorScopeAssignmentInput {
  id: string
  canEditSettings: boolean
  canWithdrawTreasury: boolean
}

export async function findModeratorScopeSetup(userId: number, zoneIds: string[], boardIds: string[]) {
  const [user, zones, boards] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
      },
    }),
    zoneIds.length > 0
      ? prisma.zone.findMany({
          where: { id: { in: zoneIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    boardIds.length > 0
      ? prisma.board.findMany({
          where: { id: { in: boardIds } },
          select: { id: true, zoneId: true },
        })
      : Promise.resolve([]),
  ])

  return { user, zones, boards }
}

export async function replaceModeratorScopes(
  userId: number,
  zoneScopes: ModeratorScopeAssignmentInput[],
  boardScopes: ModeratorScopeAssignmentInput[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.moderatorZoneScope.deleteMany({ where: { moderatorId: userId } })
    await tx.moderatorBoardScope.deleteMany({ where: { moderatorId: userId } })

    if (zoneScopes.length > 0) {
      await tx.moderatorZoneScope.createMany({
        data: zoneScopes.map((scope) => ({
          moderatorId: userId,
          zoneId: scope.id,
          canEditSettings: scope.canEditSettings,
          canWithdrawTreasury: scope.canWithdrawTreasury,
        })),
      })
    }

    if (boardScopes.length > 0) {
      await tx.moderatorBoardScope.createMany({
        data: boardScopes.map((scope) => ({
          moderatorId: userId,
          boardId: scope.id,
          canEditSettings: scope.canEditSettings,
          canWithdrawTreasury: scope.canWithdrawTreasury,
        })),
      })
    }
  })
}

export function findModeratorUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      nickname: true,
      role: true,
      status: true,
    },
  })
}

export async function findModeratorTargetContext(input: {
  targetType: "zone" | "board"
  targetId: string
}) {
  if (input.targetType === "zone") {
    const zone = await prisma.zone.findUnique({
      where: { id: input.targetId },
      select: { id: true, name: true },
    })

    return zone ? { id: zone.id, name: zone.name, type: "zone" as const } : null
  }

  const board = await prisma.board.findUnique({
    where: { id: input.targetId },
    select: { id: true, name: true, zoneId: true },
  })

  return board ? { id: board.id, name: board.name, zoneId: board.zoneId, type: "board" as const } : null
}

export async function upsertModeratorTargetScope(input: {
  moderatorId: number
  targetType: "zone" | "board"
  targetId: string
  canEditSettings: boolean
  canWithdrawTreasury: boolean
  promoteToModerator?: boolean
}) {
  return prisma.$transaction(async (tx) => {
    if (input.promoteToModerator) {
      await tx.user.update({
        where: { id: input.moderatorId },
        data: { role: UserRole.MODERATOR },
      })
    }

    if (input.targetType === "zone") {
      return tx.moderatorZoneScope.upsert({
        where: {
          moderatorId_zoneId: {
            moderatorId: input.moderatorId,
            zoneId: input.targetId,
          },
        },
        create: {
          moderatorId: input.moderatorId,
          zoneId: input.targetId,
          canEditSettings: input.canEditSettings,
          canWithdrawTreasury: input.canWithdrawTreasury,
        },
        update: {
          canEditSettings: input.canEditSettings,
          canWithdrawTreasury: input.canWithdrawTreasury,
        },
      })
    }

    return tx.moderatorBoardScope.upsert({
      where: {
        moderatorId_boardId: {
          moderatorId: input.moderatorId,
          boardId: input.targetId,
        },
      },
      create: {
        moderatorId: input.moderatorId,
        boardId: input.targetId,
        canEditSettings: input.canEditSettings,
        canWithdrawTreasury: input.canWithdrawTreasury,
      },
      update: {
        canEditSettings: input.canEditSettings,
        canWithdrawTreasury: input.canWithdrawTreasury,
      },
    })
  })
}

export function deleteModeratorTargetScope(input: {
  moderatorId: number
  targetType: "zone" | "board"
  targetId: string
}) {
  if (input.targetType === "zone") {
    return prisma.moderatorZoneScope.deleteMany({
      where: {
        moderatorId: input.moderatorId,
        zoneId: input.targetId,
      },
    })
  }

  return prisma.moderatorBoardScope.deleteMany({
    where: {
      moderatorId: input.moderatorId,
      boardId: input.targetId,
    },
  })
}
