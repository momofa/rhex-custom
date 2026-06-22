import {
  enqueueAiReplyForCommentMention,
  enqueueAiReplyForPostMention,
} from "@/lib/ai-reply"

/**
 * 统一的 @AI 触发入口。
 *
 * 所有"帖子创建/更新/评论创建/更新"等业务流程应当通过本函数
 * 告知 AI Reply 子系统检测到一次 @机器人的 mention，
 * 由 AI Reply 内部决定是否真正入队（读取配置、校验 agent 用户等）。
 *
 * 禁止业务层直接调用 `enqueueAiReplyForPostMention` /
 * `enqueueAiReplyForCommentMention`。保留这两个 export 仅为了
 * 本文件以及 ai-reply 内部测试/调度使用。
 */
export type AiMentionTrigger =
  | {
      kind: "post"
      postId: string
      triggerUserId: number
      mentionedUserIds: number[]
    }
  | {
      kind: "comment"
      postId: string
      commentId: string
      triggerUserId: number
      mentionedUserIds: number[]
    }

export async function triggerAiMention(params: AiMentionTrigger) {
  if (params.kind === "post") {
    return enqueueAiReplyForPostMention({
      postId: params.postId,
      triggerUserId: params.triggerUserId,
      mentionedUserIds: params.mentionedUserIds,
    })
  }
  return enqueueAiReplyForCommentMention({
    postId: params.postId,
    sourceCommentId: params.commentId,
    triggerUserId: params.triggerUserId,
    mentionedUserIds: params.mentionedUserIds,
  })
}