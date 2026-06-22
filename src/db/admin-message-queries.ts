import { prisma } from "@/db/client"
import { ConversationKind, type Prisma } from "@/db/types"

export async function countAdminMessageSummary(where: Prisma.ConversationWhereInput) {
  const [conversationTotal, messageTotal, participantUnread, archivedParticipantCount] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.directMessage.count({
      where: {
        conversation: where,
      },
    }),
    prisma.conversationParticipant.aggregate({
      where: {
        conversation: where,
      },
      _sum: {
        unreadCount: true,
      },
    }),
    prisma.conversationParticipant.count({
      where: {
        conversation: where,
        archivedAt: {
          not: null,
        },
      },
    }),
  ])

  return {
    conversationTotal,
    messageTotal,
    unreadTotal: participantUnread._sum.unreadCount ?? 0,
    archivedParticipantCount,
  }
}

export function findAdminMessageConversationsPage(
  where: Prisma.ConversationWhereInput,
  orderBy: Prisma.ConversationOrderByWithRelationInput[],
  skip: number,
  take: number,
) {
  return prisma.conversation.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      participants: {
        orderBy: {
          userId: "asc",
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatarPath: true,
              role: true,
              status: true,
            },
          },
        },
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatarPath: true,
            },
          },
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  })
}

export function findAdminMessageConversationDetail(conversationId: string, skip: number, take: number) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      kind: ConversationKind.DIRECT,
      messages: {
        some: {},
      },
    },
    include: {
      participants: {
        orderBy: {
          userId: "asc",
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatarPath: true,
              role: true,
              status: true,
            },
          },
        },
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatarPath: true,
            },
          },
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  })
}
