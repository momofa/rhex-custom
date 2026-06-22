import { prisma } from "@/db/client"
import { getUnreadConversationCount } from "@/db/message-read-queries"
import { ConversationKind } from "@/db/types"
import { createUserRouteHandler } from "@/lib/api-route"
import { formatMonthDayTime } from "@/lib/formatters"
import { getCachedUnreadMessageCount } from "@/lib/message-redis-cache"
import { getCachedUnreadNotificationCount } from "@/lib/notification-redis-cache"
import {
  buildInboxSnapshotPayload,
  buildCursorPayload,
  buildHeartbeatPayload,
  buildMessageEventPayload,
  compareMessageStreamCursor,
  createMessageStreamCursor,
  getMessageStreamCursorFromEvent,
  isMessageStreamCursorAfter,
  messageEventBus,
  parseMessageStreamCursor,
  type MessageStreamEvent,
  type MessageStreamCursor,
} from "@/lib/message-event-bus"
import { notificationEventBus } from "@/lib/notification-event-bus"
import { getSiteSettings } from "@/lib/site-settings"
import type { SiteSettingsData } from "@/lib/site-settings.types"
import { SITE_CHAT_ROOM_DB_ID, isSiteChatConversationId } from "@/lib/site-chat"
import { getUserDisplayName } from "@/lib/user-display"
import { normalizeMessageRealtimeHeartbeatSeconds } from "@/lib/message-realtime-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MESSAGE_CATCH_UP_BATCH_SIZE = 50

type HeartbeatWriter = (payload: string) => void
type SharedHeartbeatBucket = {
  writers: Set<HeartbeatWriter>
  timer: ReturnType<typeof setInterval> | null
}

type GlobalMessageStreamState = {
  __bbsMessageStreamHeartbeat?: Map<number, SharedHeartbeatBucket>
}

const globalMessageStreamState = globalThis as typeof globalThis & GlobalMessageStreamState

function getSharedHeartbeatState(intervalMs: number) {
  globalMessageStreamState.__bbsMessageStreamHeartbeat ??= new Map()
  let state = globalMessageStreamState.__bbsMessageStreamHeartbeat.get(intervalMs)

  if (!state) {
    state = {
      writers: new Set(),
      timer: null,
    }
    globalMessageStreamState.__bbsMessageStreamHeartbeat.set(intervalMs, state)
  }

  return state
}

function subscribeSharedHeartbeat(writer: HeartbeatWriter, intervalMs: number) {
  const state = getSharedHeartbeatState(intervalMs)
  state.writers.add(writer)

  if (!state.timer) {
    state.timer = setInterval(() => {
      const payload = buildHeartbeatPayload()
      for (const heartbeatWriter of state.writers) {
        heartbeatWriter(payload)
      }
    }, intervalMs)
  }

  return () => {
    state.writers.delete(writer)
    if (state.writers.size === 0 && state.timer) {
      clearInterval(state.timer)
      state.timer = null
      globalMessageStreamState.__bbsMessageStreamHeartbeat?.delete(intervalMs)
    }
  }
}

interface MessageStreamEventEnvelope {
  cursor: MessageStreamCursor
  event: MessageStreamEvent
}

async function getInboxSnapshot(userId: number, settings: Pick<SiteSettingsData, "messageEnabled">) {
  const unreadNotificationCount = await getCachedUnreadNotificationCount(userId, () => prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  }))

  if (!settings.messageEnabled) {
    return {
      unreadMessageCount: 0,
      unreadNotificationCount,
    }
  }

  const unreadMessageCount = await getCachedUnreadMessageCount(userId, () => getUnreadConversationCount(userId))

  return {
    unreadMessageCount,
    unreadNotificationCount,
  }
}

function mapMessageRowToEnvelope(
  userId: number,
  message: {
    id: string
    body: string
    createdAt: Date
    senderId: number
    sender: {
      username: string
      nickname: string | null
      avatarPath: string | null
    }
    conversationId: string
    conversation: {
      participants: Array<{
        userId: number
      }>
    }
  },
): MessageStreamEventEnvelope {
  const cursor = createMessageStreamCursor(message.id, message.createdAt)
  const isSiteChat = isSiteChatConversationId(message.conversationId)

  return {
    cursor,
    event: {
      type: "message.created",
      conversationId: message.conversationId,
      messageId: message.id,
      content: message.body,
      createdAtLabel: formatMonthDayTime(message.createdAt),
      senderId: message.senderId,
      senderUsername: message.sender.username,
      senderDisplayName: getUserDisplayName(message.sender),
      senderAvatarPath: message.sender.avatarPath,
      recipientId: isSiteChat ? userId : (message.conversation.participants[0]?.userId ?? userId),
      occurredAt: cursor.createdAt,
    },
  }
}

async function findLatestCursor(userId: number): Promise<MessageStreamCursor | null> {
  const latest = await prisma.directMessage.findFirst({
    where: {
      conversation: {
        participants: {
          some: {
            userId,
            archivedAt: null,
          },
        },
        OR: [
          { kind: ConversationKind.DIRECT },
          { id: SITE_CHAT_ROOM_DB_ID },
        ],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
    },
  })

  if (!latest) {
    return null
  }

  return createMessageStreamCursor(latest.id, latest.createdAt)
}

async function findMessageEventsAfterCursor(userId: number, cursor: MessageStreamCursor | null) {
  const messages = await prisma.directMessage.findMany({
    where: {
      conversation: {
        participants: {
          some: {
            userId,
            archivedAt: null,
          },
        },
        OR: [
          { kind: ConversationKind.DIRECT },
          { id: SITE_CHAT_ROOM_DB_ID },
        ],
      },
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                id: { gt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MESSAGE_CATCH_UP_BATCH_SIZE,
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      sender: {
        select: {
          username: true,
          nickname: true,
          avatarPath: true,
        },
      },
      conversationId: true,
      conversation: {
        select: {
          participants: {
            where: {
              userId: {
                not: userId,
              },
            },
            select: {
              userId: true,
            },
            take: 1,
          },
        },
      },
    },
  })

  return messages.map((message) => mapMessageRowToEnvelope(userId, message))
}

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const requestUrl = new URL(request.url)
  const cursorParam = requestUrl.searchParams.get("cursor")
  const lastEventId = request.headers.get("last-event-id")
  const requestedCursor = parseMessageStreamCursor(cursorParam) ?? parseMessageStreamCursor(lastEventId)
  const settings = await getSiteSettings()

  if (!settings.messageRealtimeEnabled) {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    })
  }

  const messageEnabled = settings.messageEnabled
  const requestedHeartbeatSeconds = normalizeMessageRealtimeHeartbeatSeconds(
    requestUrl.searchParams.get("heartbeat"),
    settings.messageRealtimeHeartbeatSeconds,
  )
  const heartbeatIntervalMs = Math.max(settings.messageRealtimeHeartbeatSeconds, requestedHeartbeatSeconds) * 1_000
  const inboxSnapshot = await getInboxSnapshot(currentUser.id, settings)
  const initialCursor = messageEnabled
    ? requestedCursor ?? await findLatestCursor(currentUser.id)
    : null
  const encoder = new TextEncoder()
  let closeStream: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let cursor = initialCursor
      let unsubscribeMessageEvents: (() => void) | null = null
      let unsubscribeNotificationEvents: (() => void) | null = null
      let unsubscribeHeartbeat: (() => void) | null = null
      let catchUpReady = false
      const bufferedCursorEvents: MessageStreamEventEnvelope[] = []
      const bufferedLiveEvents: MessageStreamEvent[] = []

      const push = (payload: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(payload))
          } catch {
            close()
          }
        }
      }

      const pushCursor = (nextCursor: MessageStreamCursor) => {
        push(buildCursorPayload(nextCursor))
      }

      const deliverEnvelope = (envelope: MessageStreamEventEnvelope) => {
        if (!isMessageStreamCursorAfter(envelope.cursor, cursor)) {
          return
        }

        cursor = envelope.cursor
        push(buildMessageEventPayload(envelope.event))
        pushCursor(cursor)
      }

      const deliverLiveEvent = (event: MessageStreamEvent) => {
        push(buildMessageEventPayload(event))
      }

      const flushBufferedCursorEvents = () => {
        if (bufferedCursorEvents.length === 0) {
          return
        }

        const pendingEvents = bufferedCursorEvents
          .splice(0, bufferedCursorEvents.length)
          .sort((left, right) => compareMessageStreamCursor(left.cursor, right.cursor))

        for (const envelope of pendingEvents) {
          if (closed) {
            return
          }

          deliverEnvelope(envelope)
        }
      }

      const flushBufferedLiveEvents = () => {
        if (bufferedLiveEvents.length === 0) {
          return
        }

        const pendingEvents = bufferedLiveEvents.splice(0, bufferedLiveEvents.length)

        for (const event of pendingEvents) {
          if (closed) {
            return
          }

          deliverLiveEvent(event)
        }
      }

      const bufferOrDeliverEvent = (event: MessageStreamEvent) => {
        const nextCursor = getMessageStreamCursorFromEvent(event)

        if (!catchUpReady) {
          if (nextCursor) {
            bufferedCursorEvents.push({ cursor: nextCursor, event })
          } else {
            bufferedLiveEvents.push(event)
          }
          return
        }

        if (nextCursor) {
          deliverEnvelope({ cursor: nextCursor, event })
          return
        }

        deliverLiveEvent(event)
      }

      const close = () => {
        if (closed) {
          return
        }

        closed = true
        closeStream = null
        request.signal.removeEventListener("abort", close)
        unsubscribeHeartbeat?.()
        unsubscribeMessageEvents?.()
        unsubscribeNotificationEvents?.()
        try {
          controller.close()
        } catch {
          // The browser may already have closed the stream.
        }
      }

      const handleStreamFailure = (error: unknown) => {
        console.error("[api/messages/stream] stream failed", error)

        if (!closed) {
          push(`event: error\ndata: ${JSON.stringify({ message: "消息流暂时不可用" })}\n\n`)
        }

        close()
      }

      const drainCatchUp = async () => {
        if (!messageEnabled) {
          return
        }

        let hasMore = true

        while (!closed && hasMore) {
          const events = await findMessageEventsAfterCursor(currentUser.id, cursor)

          if (events.length === 0) {
            hasMore = false
            continue
          }

          for (const envelope of events) {
            if (closed) {
              return
            }

            deliverEnvelope(envelope)
          }

          hasMore = events.length === MESSAGE_CATCH_UP_BATCH_SIZE
        }
      }

      if (messageEnabled) {
        unsubscribeMessageEvents = messageEventBus.subscribe(currentUser.id, (event) => {
          const nextCursor = getMessageStreamCursorFromEvent(event)
          if (nextCursor && !isMessageStreamCursorAfter(nextCursor, cursor)) {
            return
          }

          bufferOrDeliverEvent(event)
        })
      }

      unsubscribeNotificationEvents = notificationEventBus.subscribe(currentUser.id, (event) => {
        bufferOrDeliverEvent(event)
      })

      push(buildHeartbeatPayload())
      push(buildInboxSnapshotPayload({
        unreadMessageCount: inboxSnapshot.unreadMessageCount,
        unreadNotificationCount: inboxSnapshot.unreadNotificationCount,
        occurredAt: new Date().toISOString(),
      }))
      if (cursor) {
        pushCursor(cursor)
      }

      unsubscribeHeartbeat = subscribeSharedHeartbeat(push, heartbeatIntervalMs)

      request.signal.addEventListener("abort", close)
      closeStream = close

      void drainCatchUp()
        .then(() => {
          flushBufferedCursorEvents()
          flushBufferedLiveEvents()
          catchUpReady = true
          flushBufferedCursorEvents()
          flushBufferedLiveEvents()
        })
        .catch(handleStreamFailure)
    },
    cancel() {
      closeStream?.()
      closeStream = null
      return
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}, {
  errorMessage: "消息流建立失败",
  logPrefix: "[api/messages/stream] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
