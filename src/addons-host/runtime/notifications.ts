import "server-only"

import { createSystemNotification } from "@/lib/notification-writes"
import { resolveAddonActor } from "@/addons-host/runtime/actors"
import { mapAddonNotificationRecord } from "@/addons-host/runtime/notification-record"
import type {
  AddonNotificationCreateInput,
  AddonNotificationRecord,
} from "@/addons-host/types"

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

async function resolveNotificationRecipient(input: AddonNotificationCreateInput) {
  return resolveAddonActor({
    userId: input.recipientId,
    username: input.recipientUsername,
    label: "通知接收账号",
  })
}

export async function createAddonNotification(
  input: AddonNotificationCreateInput,
): Promise<AddonNotificationRecord> {
  const recipient = await resolveNotificationRecipient(input)
  const notification = await createSystemNotification({
    userId: recipient.id,
    senderId: input.senderId ?? null,
    relatedType: input.relatedType ?? "ANNOUNCEMENT",
    relatedId: normalizeOptionalString(input.relatedId),
    url: input.url ?? null,
    title: normalizeOptionalString(input.title),
    content: normalizeOptionalString(input.content),
  })

  return mapAddonNotificationRecord(notification)
}

export async function createAddonNotifications(
  inputs: AddonNotificationCreateInput[],
): Promise<AddonNotificationRecord[]> {
  return Promise.all((Array.isArray(inputs) ? inputs : []).map((input) => createAddonNotification(input)))
}
