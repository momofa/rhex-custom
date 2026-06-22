import { createCommentMentionNotifications, updateCommentContentById, findEditableCommentById } from "@/db/comment-queries"

import { queryAddonComments } from "@/addons-host/runtime/comments"
import { executeAddonActionHook, executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { resolveHookedStringValue } from "@/lib/addon-hook-values"
import { canAdminActorManageBoardWithPermission } from "@/lib/admin-scope-permissions"
import { apiError } from "@/lib/api-route"
import type { SessionActor } from "@/lib/auth"
import { enforceSensitiveText } from "@/lib/content-safety"
import { extractMentionTexts, findMentionUsers, resolveMentionsInText } from "@/lib/comment-mentions"
import { resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"
import { getSiteSettings } from "@/lib/site-settings"
import { validateCommentPayload } from "@/lib/validators"

export async function updateCommentFlow(input: {
  body: unknown
  request: Request
  currentUser: SessionActor
}) {
  const settings = await getSiteSettings()
  const validated = validateCommentPayload(input.body, {
    contentMinLength: settings.commentContentMinLength,
    contentMaxLength: settings.commentContentMaxLength,
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }
  const requestUrl = new URL(input.request.url)
  const hookContext = {
    request: input.request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  }

  const { postId, content } = validated.data
  const rawBody = input.body as Record<string, unknown> | null
  const rawCommentId = rawBody?.commentId
  const commentId = typeof rawCommentId === "string" ? rawCommentId.trim() : ""

  if (!commentId) {
    apiError(400, "缺少评论 ID")
  }

  const comment = await findEditableCommentById(commentId)

  if (!comment || comment.postId !== postId || comment.status !== "NORMAL") {
    apiError(404, "评论不存在或不可编辑")
  }

  const adminActor = await resolveAdminActorFromSessionUser(input.currentUser)
  const canManageComment = Boolean(
    adminActor
    && await canAdminActorManageBoardWithPermission(
      adminActor,
      "admin.comments.manage",
      comment.post.boardId,
      comment.post.board.zoneId,
    ),
  )
  const isOwner = comment.userId === input.currentUser.id

  if (!canManageComment && !isOwner) {
    apiError(403, "没有权限编辑该评论")
  }

  if (!canManageComment) {
    const editWindowMinutes = Math.max(0, settings.commentEditableMinutes)
    const expiresAt = new Date(comment.createdAt).getTime() + editWindowMinutes * 60 * 1000
    if (Date.now() > expiresAt) {
      apiError(403, `该评论已超过 ${editWindowMinutes} 分钟编辑窗口`)
    }
  }

  const hookedCommentContentResult = await executeAddonWaterfallHook("comment.content.value", content, {
    ...hookContext,
    payload: {
      mode: "update",
      postId,
      commentId,
    },
  })
  const { value: hookedContent, changed: contentHookAdjusted } = resolveHookedStringValue(content, hookedCommentContentResult.value)
  const contentSafety = await enforceSensitiveText({ scene: "comment.content", text: hookedContent })
  const mentionTexts = extractMentionTexts(contentSafety.sanitizedText)
  const mentionUsers = await findMentionUsers(mentionTexts)
  const resolvedComment = resolveMentionsInText(contentSafety.sanitizedText, mentionUsers)

  await executeAddonActionHook("comment.update.before", {
    commentId,
    editorId: String(input.currentUser.id),
    changes: { content: resolvedComment.content },
  }, {
    ...hookContext,
    throwOnError: true,
  })

  const updated = await updateCommentContentById(commentId, {
    content: resolvedComment.content,
    reviewNote: null,
  })

  await createCommentMentionNotifications({
    commentId: updated.id,
    senderId: input.currentUser.id,
    senderName: input.currentUser.nickname || input.currentUser.username || "用户",
    content: resolvedComment.content,
    mentionUserIds: resolvedComment.mentions.map((item) => item.id),
    excludeUserIds: [updated.replyToUserId ?? 0],
  })

  const updatedComment = (await queryAddonComments({
    ids: [updated.id],
    statuses: ["NORMAL", "HIDDEN", "PENDING"],
    limit: 1,
  })).items[0]
  await executeAddonActionHook("comment.update.after", {
    commentId: updated.id,
    editorId: String(input.currentUser.id),
    changes: { content: resolvedComment.content },
    ...(updatedComment ? { comment: updatedComment } : {}),
  }, hookContext)

  return {
    updated,
    postSlug: comment.post.slug,
    boardSlug: comment.post.board.slug,
    zoneSlug: comment.post.board.zone?.slug,
    contentSafety,
    contentAdjusted: contentHookAdjusted || contentSafety.wasReplaced,
    mentionUserIds: resolvedComment.mentions.map((item) => item.id),
  }
}
