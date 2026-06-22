import { randomUUID } from "node:crypto"

import { logError } from "@/lib/logger"
import type { InboxStreamEvent, NotificationCountStreamEvent } from "@/lib/message-types"
import { connectRedisClient, createRedisConnection, createRedisKey } from "@/lib/redis"
import { REDIS_KEY_SCOPES } from "@/lib/redis-keys"

type NotificationEventListener = (event: NotificationCountStreamEvent) => void

interface NotificationEventSubscriber {
  userId: number
  listener: NotificationEventListener
}

type GlobalNotificationEventBusState = {
  __bbsNotificationEventBus?: NotificationEventBus
  __bbsRedisNotificationEventBusRuntime?: RedisNotificationEventBusRuntime
}

const globalNotificationEventBus = globalThis as typeof globalThis & GlobalNotificationEventBusState

function getNotificationEventChannel() {
  return createRedisKey(...REDIS_KEY_SCOPES.notifications.eventPubSub)
}

function isNotificationCountEvent(event: InboxStreamEvent): event is NotificationCountStreamEvent {
  return event.type === "notification.count"
}

class NotificationEventBus {
  private nextSubscriberId = 1

  private readonly subscribers = new Map<number, NotificationEventSubscriber>()
  private readonly subscriberIdsByUserId = new Map<number, Set<number>>()

  subscribe(userId: number, listener: NotificationEventListener) {
    void ensureNotificationEventBusRuntimeReady()

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

  async publish(event: NotificationCountStreamEvent) {
    this.publishLocal(event)

    try {
      const runtime = getRedisNotificationEventBusRuntime()
      await runtime.ensurePublisherReady()
      await runtime.publish(event)
    } catch (error) {
      logError({
        scope: "notification-event-bus",
        action: "publish",
        metadata: {
          userId: event.userId,
          notificationId: event.notificationId ?? null,
          reason: event.reason,
        },
      }, error)
    }
  }

  publishLocal(event: NotificationCountStreamEvent) {
    const subscriberIds = this.subscriberIdsByUserId.get(event.userId)
    if (!subscriberIds) {
      return
    }

    for (const subscriberId of subscriberIds) {
      const subscriber = this.subscribers.get(subscriberId)
      if (!subscriber) {
        continue
      }

      try {
        subscriber.listener(event)
      } catch (error) {
        console.error("[notification-event-bus] subscriber failed", error)
      }
    }
  }
}

class RedisNotificationEventBusRuntime {
  private readonly runtimeId = randomUUID()
  private readonly publisher = createRedisConnection("notification-bus:publisher")
  private readonly subscriber = createRedisConnection("notification-bus:subscriber")
  private publisherReadyPromise: Promise<void> | null = null
  private subscriberReadyPromise: Promise<void> | null = null
  private subscriberStarted = false

  constructor(private readonly bus: NotificationEventBus) {}

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

  async publish(event: NotificationCountStreamEvent) {
    await this.ensurePublisherReady()
    await this.publisher.publish(getNotificationEventChannel(), JSON.stringify({
      event,
      origin: this.runtimeId,
    }))
  }

  private async startSubscriber() {
    if (!this.subscriberStarted) {
      this.subscriberStarted = true
      this.subscriber.on("message", (channel, rawMessage) => {
        if (channel !== getNotificationEventChannel()) {
          return
        }

        try {
          const payload = JSON.parse(rawMessage) as {
            event?: InboxStreamEvent
            origin?: string
          }

          if (!payload?.event || payload.origin === this.runtimeId || !isNotificationCountEvent(payload.event)) {
            return
          }

          this.bus.publishLocal(payload.event)
        } catch (error) {
          logError({
            scope: "notification-event-bus",
            action: "consume",
          }, error)
        }
      })
    }

    await connectRedisClient(this.subscriber)
    await this.subscriber.subscribe(getNotificationEventChannel())
  }
}

export const notificationEventBus = globalNotificationEventBus.__bbsNotificationEventBus ?? new NotificationEventBus()

if (!globalNotificationEventBus.__bbsNotificationEventBus) {
  globalNotificationEventBus.__bbsNotificationEventBus = notificationEventBus
}

function getRedisNotificationEventBusRuntime() {
  const runtime = globalNotificationEventBus.__bbsRedisNotificationEventBusRuntime ?? new RedisNotificationEventBusRuntime(notificationEventBus)

  if (!globalNotificationEventBus.__bbsRedisNotificationEventBusRuntime) {
    globalNotificationEventBus.__bbsRedisNotificationEventBusRuntime = runtime
  }

  return runtime
}

export async function ensureNotificationEventBusRuntimeReady() {

  await getRedisNotificationEventBusRuntime().ensureSubscriberReady()
}
