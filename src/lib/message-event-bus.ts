import { randomUUID } from "node:crypto"

import { logError } from "@/lib/logger"
import type { InboxSnapshotStreamEvent, MessageStreamEvent } from "@/lib/message-types"
import { connectRedisClient, createRedisConnection, createRedisKey } from "@/lib/redis"
import { REDIS_KEY_SCOPES } from "@/lib/redis-keys"

export type { MessageStreamEvent } from "@/lib/message-types"

export interface MessageStreamCursor {
  id: string
  createdAt: string
}

type MessageEventListener = (event: MessageStreamEvent) => void
type MessageEventTargets = Set<number> | "all"

interface MessageEventSubscriber {
  userId: number
  listener: MessageEventListener
}

type GlobalMessageEventBusState = {
  __bbsMessageEventBus?: MessageEventBus
  __bbsRedisMessageEventBusRuntime?: RedisMessageEventBusRuntime
}

const globalMessageEventBus = globalThis as typeof globalThis & GlobalMessageEventBusState

function getMessageEventChannel() {
  return createRedisKey(...REDIS_KEY_SCOPES.messages.eventPubSub)
}

function getEventTargets(event: MessageStreamEvent): MessageEventTargets {
  if ("broadcast" in event && event.broadcast === "site-chat") {
    return "all"
  }

  if ("targetUserIds" in event && Array.isArray(event.targetUserIds) && event.targetUserIds.length > 0) {
    return new Set(event.targetUserIds.filter((userId): userId is number => Number.isFinite(userId)))
  }

  const userIds = new Set<number>()

  if ("userId" in event && typeof event.userId === "number") {
    userIds.add(event.userId)
  }

  if ("senderId" in event && typeof event.senderId === "number") {
    userIds.add(event.senderId)
  }

  if ("recipientId" in event && typeof event.recipientId === "number") {
    userIds.add(event.recipientId)
  }

  return userIds
}

class MessageEventBus {
  private nextSubscriberId = 1

  private readonly subscribers = new Map<number, MessageEventSubscriber>()
  private readonly subscriberIdsByUserId = new Map<number, Set<number>>()

  subscribe(userId: number, listener: MessageEventListener) {
    void ensureMessageEventBusRuntimeReady()

    const subscriberId = this.nextSubscriberId
    this.nextSubscriberId += 1
    this.subscribers.set(subscriberId, { userId, listener })
    const userSubscriberIds = this.subscriberIdsByUserId.get(userId) ?? new Set<number>()
    userSubscriberIds.add(subscriberId)
    this.subscriberIdsByUserId.set(userId, userSubscriberIds)

    return () => {
      this.subscribers.delete(subscriberId)
      userSubscriberIds.delete(subscriberId)
      if (userSubscriberIds.size === 0) {
        this.subscriberIdsByUserId.delete(userId)
      }
    }
  }

  async publish(event: MessageStreamEvent) {
    this.publishLocal(event)

    try {
      const runtime = getRedisMessageEventBusRuntime()
      await runtime.ensurePublisherReady()
      await runtime.publish(event)
    } catch (error) {
      logError({
        scope: "message-event-bus",
        action: "publish",
        metadata: {
          conversationId: "conversationId" in event ? event.conversationId : undefined,
          messageId: "messageId" in event ? event.messageId : undefined,
        },
      }, error)
    }
  }

  publishLocal(event: MessageStreamEvent) {
    const targets = getEventTargets(event)
    if (targets !== "all" && targets.size === 0) {
      return
    }

    const deliverToSubscriber = (subscriber: MessageEventSubscriber) => {
      try {
        subscriber.listener(event)
      } catch (error) {
        console.error("[message-event-bus] subscriber failed", error)
      }
    }

    if (targets === "all") {
      for (const subscriber of this.subscribers.values()) {
        deliverToSubscriber(subscriber)
      }
      return
    }

    const deliveredSubscriberIds = new Set<number>()
    for (const userId of targets) {
      const subscriberIds = this.subscriberIdsByUserId.get(userId)
      if (!subscriberIds) {
        continue
      }

      for (const subscriberId of subscriberIds) {
        if (deliveredSubscriberIds.has(subscriberId)) {
          continue
        }

        const subscriber = this.subscribers.get(subscriberId)
        if (!subscriber) {
          continue
        }

        deliveredSubscriberIds.add(subscriberId)
        deliverToSubscriber(subscriber)
      }
    }
  }
}

class RedisMessageEventBusRuntime {
  private readonly runtimeId = randomUUID()
  private readonly publisher = createRedisConnection("message-bus:publisher")
  private readonly subscriber = createRedisConnection("message-bus:subscriber")
  private publisherReadyPromise: Promise<void> | null = null
  private subscriberReadyPromise: Promise<void> | null = null
  private subscriberStarted = false

  constructor(private readonly bus: MessageEventBus) {}

  async ensurePublisherReady() {
    this.publisherReadyPromise ??= connectRedisClient(this.publisher)
      .then(() => undefined)
      .catch((error) => {
        this.publisherReadyPromise = null
        throw error
      })

    return this.publisherReadyPromise
  }

  async ensureSubscriberReady() {
    this.subscriberReadyPromise ??= this.startSubscriber()
      .catch((error) => {
        this.subscriberReadyPromise = null
        throw error
      })

    return this.subscriberReadyPromise
  }

  async publish(event: MessageStreamEvent) {
    await this.ensurePublisherReady()
    await this.publisher.publish(getMessageEventChannel(), JSON.stringify({
      event,
      origin: this.runtimeId,
    }))
  }

  private async startSubscriber() {
    if (!this.subscriberStarted) {
      this.subscriberStarted = true
      this.subscriber.on("message", (channel, rawMessage) => {
        if (channel !== getMessageEventChannel()) {
          return
        }

        try {
          const payload = JSON.parse(rawMessage) as {
            event?: MessageStreamEvent
            origin?: string
          }

          if (!payload?.event || payload.origin === this.runtimeId) {
            return
          }

          this.bus.publishLocal(payload.event)
        } catch (error) {
          logError({
            scope: "message-event-bus",
            action: "consume",
          }, error)
        }
      })
    }

    await connectRedisClient(this.subscriber)
    await this.subscriber.subscribe(getMessageEventChannel())
  }
}

export const messageEventBus = globalMessageEventBus.__bbsMessageEventBus ?? new MessageEventBus()

if (!globalMessageEventBus.__bbsMessageEventBus) {
  globalMessageEventBus.__bbsMessageEventBus = messageEventBus
}

function getRedisMessageEventBusRuntime() {
  const runtime = globalMessageEventBus.__bbsRedisMessageEventBusRuntime ?? new RedisMessageEventBusRuntime(messageEventBus)

  if (!globalMessageEventBus.__bbsRedisMessageEventBusRuntime) {
    globalMessageEventBus.__bbsRedisMessageEventBusRuntime = runtime
  }

  return runtime
}

export async function ensureMessageEventBusRuntimeReady() {
  await getRedisMessageEventBusRuntime().ensureSubscriberReady()
}

export function buildMessageEventPayload(event: MessageStreamEvent) {
  const cursor = getMessageStreamCursorFromEvent(event)
  const cursorId = cursor ? formatMessageStreamCursor(cursor) : undefined
  return `${cursorId ? `id: ${cursorId}\n` : ""}data: ${JSON.stringify(event)}\n\n`
}

export function buildHeartbeatPayload() {
  return `data: ${JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() })}\n\n`
}

export function buildInboxSnapshotPayload(snapshot: Omit<InboxSnapshotStreamEvent, "type">) {
  return `data: ${JSON.stringify({ type: "inbox.snapshot", ...snapshot })}\n\n`
}

export function buildCursorPayload(cursor: MessageStreamCursor) {
  return `event: cursor\ndata: ${JSON.stringify({ cursor: formatMessageStreamCursor(cursor) })}\n\n`
}

export function createMessageStreamCursor(id: string, createdAt: Date | string): MessageStreamCursor {
  return {
    id,
    createdAt: typeof createdAt === "string" ? new Date(createdAt).toISOString() : createdAt.toISOString(),
  }
}

export function compareMessageStreamCursor(left: MessageStreamCursor, right: MessageStreamCursor) {
  if (left.createdAt < right.createdAt) {
    return -1
  }

  if (left.createdAt > right.createdAt) {
    return 1
  }

  return left.id.localeCompare(right.id)
}

export function isMessageStreamCursorAfter(cursor: MessageStreamCursor, baseline: MessageStreamCursor | null) {
  if (!baseline) {
    return true
  }

  return compareMessageStreamCursor(cursor, baseline) > 0
}

export function getMessageStreamCursorFromEvent(event: { type?: string; messageId?: string; occurredAt?: string }) {
  if (event.type && event.type !== "message.created") {
    return null
  }

  if (!event.messageId || !event.occurredAt) {
    return null
  }

  return createMessageStreamCursor(event.messageId, event.occurredAt)
}

export function parseMessageStreamCursor(value: string | null): MessageStreamCursor | null {
  if (!value) {
    return null
  }

  const [createdAt, id] = value.split("|")
  if (!createdAt || !id) {
    return null
  }

  const timestamp = new Date(createdAt)
  if (Number.isNaN(timestamp.getTime())) {
    return null
  }

  return {
    id,
    createdAt: timestamp.toISOString(),
  }
}

export function formatMessageStreamCursor(cursor: MessageStreamCursor) {
  return `${cursor.createdAt}|${cursor.id}`
}
