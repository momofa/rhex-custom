import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import type { TimestampCursorPayload } from "@/lib/cursor-pagination"

export function countUserPointLogs(userId: number, where?: Prisma.PointLogWhereInput) {
  return prisma.pointLog.count({
    where: {
      userId,
      ...(where ?? {}),
    },
  })
}

export function listUserPointLogsInRange(params: {
  userId: number
  start: Date
  end: Date
  order?: "asc" | "desc"
}) {
  return prisma.pointLog.findMany({
    where: {
      userId: params.userId,
      createdAt: {
        gte: params.start,
        lt: params.end,
      },
    },
    orderBy: [
      { createdAt: params.order ?? "asc" },
      { id: params.order ?? "asc" },
    ],
  })
}

function buildPointLogCursorWhere(
  userId: number,
  cursor: TimestampCursorPayload,
  direction: "after" | "before",
  where?: Prisma.PointLogWhereInput,
): Prisma.PointLogWhereInput {
  const createdAt = new Date(cursor.createdAt)

  return {
    userId,
    ...(where ?? {}),
    OR: direction === "after"
      ? [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: cursor.id } },
        ]
      : [
          { createdAt: { gt: createdAt } },
          { createdAt, id: { gt: cursor.id } },
        ],
  }
}

export async function findUserPointLogsCursor(params: {
  userId: number
  take: number
  after?: TimestampCursorPayload | null
  before?: TimestampCursorPayload | null
  where?: Prisma.PointLogWhereInput
}) {
  const normalizedTake = Math.min(Math.max(1, params.take), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after
  const rows = await prisma.pointLog.findMany({
    where: cursor
      ? buildPointLogCursorWhere(params.userId, cursor, pagingDirection, params.where)
      : {
          userId: params.userId,
          ...(params.where ?? {}),
        },
    orderBy: pagingDirection === "before"
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : [{ createdAt: "desc" }, { id: "desc" }],
    take: normalizedTake + 1,
  })

  const hasExtra = rows.length > normalizedTake
  const slicedRows = hasExtra ? rows.slice(0, normalizedTake) : rows
  const items = pagingDirection === "before" ? [...slicedRows].reverse() : slicedRows

  return {
    items,
    hasPrevPage: params.before ? hasExtra : Boolean(params.after),
    hasNextPage: params.before ? true : hasExtra,
  }
}
