import { CommentStatus, type Prisma } from "@/db/types"

import { prisma } from "@/db/client"

type CommentOfflineQueryClient = Prisma.TransactionClient | typeof prisma

function resolveClient(client?: CommentOfflineQueryClient) {
  return client ?? prisma
}

export function findCommentOfflineTarget(commentId: string, client?: CommentOfflineQueryClient) {
  return resolveClient(client).comment.findUnique({
    where: { id: commentId },
    include: {
      post: {
        include: {
          board: {
            include: {
              zone: true,
            },
          },
        },
      },
    },
  })
}

export function updateCommentOfflineTarget(
  client: CommentOfflineQueryClient,
  params: {
    commentId: string
    actorId: number
    reviewNote: string
  },
) {
  return client.comment.update({
    where: { id: params.commentId },
    data: {
      status: CommentStatus.HIDDEN,
      reviewNote: params.reviewNote,
      reviewedById: params.actorId,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      postId: true,
      userId: true,
      status: true,
      reviewNote: true,
      post: {
        select: {
          id: true,
          slug: true,
          title: true,
          board: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  })
}

export function runCommentOfflineTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
