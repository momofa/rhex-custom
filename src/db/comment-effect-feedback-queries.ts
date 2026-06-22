import { randomUUID } from "node:crypto"

import { prisma } from "@/db/client"
import { Prisma } from "@/db/types"
import type { PostRewardPoolEffectFeedback } from "@/lib/post-reward-effect-feedback"

type CommentEffectFeedbackClient = Prisma.TransactionClient | typeof prisma

export interface CommentEffectFeedbackRecord {
  commentId: string
  feedbackJson: string
}

export async function upsertCommentEffectFeedback(params: {
  tx: CommentEffectFeedbackClient
  postId: string
  commentId: string
  userId: number
  scene: string
  rewardClaimId?: string | null
  feedback: PostRewardPoolEffectFeedback
}) {
  const id = `cef_${randomUUID()}`

  return params.tx.$executeRaw(Prisma.sql`
    INSERT INTO "CommentEffectFeedback" (
      "id",
      "postId",
      "commentId",
      "userId",
      "scene",
      "rewardClaimId",
      "feedbackJson",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${params.postId},
      ${params.commentId},
      ${params.userId},
      ${params.scene},
      ${params.rewardClaimId ?? null},
      ${JSON.stringify(params.feedback)}::JSONB,
      NOW(),
      NOW()
    )
    ON CONFLICT ("commentId") DO UPDATE
    SET
      "postId" = EXCLUDED."postId",
      "userId" = EXCLUDED."userId",
      "scene" = EXCLUDED."scene",
      "rewardClaimId" = EXCLUDED."rewardClaimId",
      "feedbackJson" = EXCLUDED."feedbackJson",
      "updatedAt" = NOW()
  `)
}

export async function findCommentEffectFeedbackByCommentIds(postId: string, commentIds: string[]) {
  if (commentIds.length === 0) {
    return []
  }

  return prisma.$queryRaw<CommentEffectFeedbackRecord[]>(Prisma.sql`
    SELECT
      feedback."commentId",
      feedback."feedbackJson"::TEXT AS "feedbackJson"
    FROM "CommentEffectFeedback" feedback
    WHERE
      feedback."postId" = ${postId}
      AND feedback."commentId" IN (${Prisma.join(commentIds)})
  `)
}
