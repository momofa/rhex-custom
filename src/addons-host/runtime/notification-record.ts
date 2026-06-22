import type { AddonNotificationRecord } from "@/addons-host/types"

interface AddonNotificationRecordSource {
  id: string
  userId: number
  type: AddonNotificationRecord["type"]
  senderId: number | null
  relatedType: string
  relatedId: string
  url?: string | null
  title: string
  content: string
  createdAt: Date
}

export function mapAddonNotificationRecord(
  notification: AddonNotificationRecordSource,
): AddonNotificationRecord {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    senderId: notification.senderId ?? null,
    relatedType: notification.relatedType as AddonNotificationRecord["relatedType"],
    relatedId: notification.relatedId,
    url: notification.url ?? null,
    title: notification.title,
    content: notification.content,
    createdAt: notification.createdAt.toISOString(),
  }
}
