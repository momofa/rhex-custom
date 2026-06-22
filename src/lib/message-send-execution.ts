import type { CurrentUserRecord } from "@/db/current-user"

import { executeAddonActionHook, executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { resolveHookedStringValue } from "@/lib/addon-hook-values"
import { logError } from "@/lib/logger"
import { summarizeMessagePreview } from "@/lib/message-media"
import { assertMessageFeatureEnabled, sendDirectMessage } from "@/lib/messages"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { isSiteChatConversationId } from "@/lib/site-chat"
import { enqueueUserNotificationDeliveries } from "@/lib/user-notification-delivery"
import { getUserDisplayName } from "@/lib/user-display"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { withRequestWriteGuard, withWriteGuard } from "@/lib/write-guard"
import { createRequestWriteGuardOptions, createWriteGuardOptions } from "@/lib/write-guard-policies"

type MessageExecutionActor = Pick<CurrentUserRecord, "id" | "username" | "nickname" | "avatarPath" | "status">

interface ExecuteDirectMessageSendInput {
  recipientId?: number
  conversationId?: string
  body: string
}

interface ExecuteDirectMessageSendOptions {
  request: Request
  sender: MessageExecutionActor
  log?: {
    scope: string
    action: string
    extra?: Record<string, unknown>
  }
}

function assertMessageSenderStatus(sender: MessageExecutionActor) {
  if (sender.status === "ACTIVE" || sender.status === "MUTED") {
    return
  }

  if (sender.status === "BANNED") {
    throw new Error("账号已被拉黑，无法发送私信")
  }

  throw new Error("账号未激活，无法发送私信")
}

async function runMessageWriteGuard<T>(
  input: ExecuteDirectMessageSendInput,
  senderId: number,
  request: Request | undefined,
  task: () => Promise<T>,
) {
  if (request) {
    return withRequestWriteGuard(createRequestWriteGuardOptions("messages-send", {
      request,
      userId: senderId,
      input: {
        recipientId: input.recipientId,
        body: input.body,
      },
    }), task)
  }

  return withWriteGuard({
    ...createWriteGuardOptions("messages-send", {
      userId: senderId,
      input: {
        recipientId: input.recipientId,
        body: input.body,
      },
    }),
    identity: {
      userId: senderId,
    },
  }, task)
}

export async function executeDirectMessageSend(
  input: ExecuteDirectMessageSendInput,
  options: ExecuteDirectMessageSendOptions,
) {
  assertMessageSenderStatus(options.sender)
  await assertMessageFeatureEnabled()
  const requestUrl = new URL(options.request.url)

  return runMessageWriteGuard(input, options.sender.id, options.request, async () => {
    const normalizedConversationId = input.conversationId?.trim()
    const recipientId = input.recipientId
    const conversationKind = isSiteChatConversationId(normalizedConversationId) ? "SITE_CHAT" : "DIRECT"
    const bodyHookResult = await executeAddonWaterfallHook("message.body.value", input.body, {
      request: options.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      payload: {
        recipientId,
        conversationId: normalizedConversationId,
        conversationKind,
      },
    })
    const { value: hookedBody, changed: bodyHookAdjusted } = resolveHookedStringValue(input.body, bodyHookResult.value)

    await executeAddonActionHook("message.send.before", {
      senderId: options.sender.id,
      senderUsername: options.sender.username,
      recipientId: recipientId ?? 0,
      conversationId: normalizedConversationId,
      conversationKind,
      body: hookedBody,
    }, {
      request: options.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    })

    const data = conversationKind === "SITE_CHAT"
      ? await sendDirectMessage(options.sender.id, undefined, hookedBody, {
          conversationId: normalizedConversationId,
        })
      : typeof recipientId === "number"
        ? await sendDirectMessage(options.sender.id, recipientId, hookedBody)
        : (() => {
            throw new Error("缺少接收方信息")
          })()
    const contentAdjusted = bodyHookAdjusted || data.contentAdjusted

    await executeAddonActionHook("message.send.after", {
      senderId: options.sender.id,
      senderUsername: options.sender.username,
      recipientId: recipientId ?? 0,
      messageId: data.id,
      conversationId: data.conversationId,
      conversationKind,
      body: data.content,
      contentAdjusted,
      occurredAt: data.occurredAt,
    }, {
      request: options.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
    })

    revalidateUserSurfaceCache(options.sender.id)
    if ("participantUserIds" in data && Array.isArray(data.participantUserIds)) {
      for (const participantUserId of data.participantUserIds) {
        revalidateUserSurfaceCache(participantUserId)
      }
    } else if (!isSiteChatConversationId(normalizedConversationId) && typeof recipientId === "number") {
      revalidateUserSurfaceCache(recipientId)
    }

    if (!isSiteChatConversationId(normalizedConversationId) && typeof recipientId === "number") {
      void enqueueUserNotificationDeliveries({
        userId: recipientId,
        event: {
          type: "privateMessage",
          message: {
            id: data.id,
            conversationId: data.conversationId,
            content: data.content,
            preview: summarizeMessagePreview(data.content),
            createdAt: data.occurredAt,
            inboxPath: `/messages?conversation=${encodeURIComponent(data.conversationId)}`,
          },
          sender: {
            id: options.sender.id,
            username: options.sender.username,
            displayName: getUserDisplayName(options.sender, options.sender.username),
            avatarPath: options.sender.avatarPath ?? null,
          },
        },
      }).catch((error) => {
        logError({
          scope: "user-notification-delivery",
          action: "enqueue-private-message",
          userId: options.sender.id,
          targetId: data.id,
          metadata: {
            recipientId,
            conversationId: data.conversationId,
          },
        }, error)
      })
    }

    if (options.log) {
      logRouteWriteSuccess({
        scope: options.log.scope,
        action: options.log.action,
      }, {
        userId: options.sender.id,
        targetId: normalizedConversationId || String(recipientId),
        extra: {
          conversationId: data.conversationId,
          messageId: data.id,
          contentAdjusted,
          conversationKind,
          ...(options.log.extra ?? {}),
        },
      })
    }

    return {
      ...data,
      contentAdjusted,
    }
  })
}
