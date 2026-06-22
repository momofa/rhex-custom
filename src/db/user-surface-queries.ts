import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

const userSurfaceSelect = {
  id: true,
  postCount: true,
  points: true,
  likeReceivedCount: true,
  _count: {
    select: {
      followedByUsers: true,
    },
  },
  levelProgress: {
    select: {
      checkInDays: true,
      currentCheckInStreak: true,
      maxCheckInStreak: true,
      lastCheckInDate: true,
    },
  },
} satisfies Prisma.UserSelect

export type UserSurfaceBaseRecord = Prisma.UserGetPayload<{ select: typeof userSurfaceSelect }>

export function findUserSurfaceBaseById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userSurfaceSelect,
  })
}

export function countUserSurfaceBoardFollows(userId: number) {
  return prisma.boardFollow.count({ where: { userId } })
}

export function countUserSurfaceFavorites(userId: number) {
  return prisma.favorite.count({ where: { userId } })
}

const checkInDelegate = prisma as typeof prisma & {
  userCheckInLog?: {
    findUnique: (args: {
      where: {
        userId_checkedInOn: {
          userId: number
          checkedInOn: string
        }
      }
    }) => Promise<unknown>
  }
}

export function findUserSurfaceCheckInRecord(userId: number, checkedInOn: string) {
  return checkInDelegate.userCheckInLog?.findUnique({
    where: {
      userId_checkedInOn: {
        userId,
        checkedInOn,
      },
    },
  }) ?? Promise.resolve(null)
}
