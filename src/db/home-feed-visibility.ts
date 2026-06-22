import type { Prisma } from "@/db/types"

export const HOME_VISIBLE_BOARD_WHERE: Prisma.BoardWhereInput = {
  OR: [
    { showInHomeFeed: true },
    {
      showInHomeFeed: null,
      OR: [
        { zoneId: null },
        { zone: { showInHomeFeed: true } },
      ],
    },
  ],
}

export function buildHomeVisiblePostWhere(): Prisma.PostWhereInput {
  return {
    board: HOME_VISIBLE_BOARD_WHERE,
  }
}
