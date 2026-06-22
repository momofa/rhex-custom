import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export async function countAdminPostSummary(where: Prisma.PostWhereInput) {
  const [total, statusGroups, flagGroups] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.post.groupBy({
      by: ["isPinned", "isFeatured", "isAnnouncement"],
      where,
      _count: {
        _all: true,
      },
    }),
  ])

  let pending = 0
  let normal = 0
  let offline = 0

  for (const group of statusGroups) {
    if (group.status === "PENDING") {
      pending += group._count._all
    } else if (group.status === "NORMAL") {
      normal += group._count._all
    } else if (group.status === "OFFLINE") {
      offline += group._count._all
    }
  }

  let pinned = 0
  let featured = 0
  let announcement = 0

  for (const group of flagGroups) {
    if (group.isPinned) {
      pinned += group._count._all
    }

    if (group.isFeatured) {
      featured += group._count._all
    }

    if (group.isAnnouncement) {
      announcement += group._count._all
    }
  }

  return {
    total,
    pending,
    normal,
    offline,
    pinned,
    featured,
    announcement,
  }
}

export function findAdminPostBoardOptions(where?: Prisma.BoardWhereInput) {
  return prisma.board.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { slug: true, name: true, zone: { select: { name: true } } },
    take: 200,
  })
}

export function findAdminPostsPage(where: Prisma.PostWhereInput, orderBy: Prisma.PostOrderByWithRelationInput[], skip: number, take: number) {
  return prisma.post.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      board: { select: { name: true, slug: true, zone: { select: { name: true } } } },
      author: { select: { id: true, username: true, nickname: true, avatarPath: true, status: true } },
    },
  })
}
