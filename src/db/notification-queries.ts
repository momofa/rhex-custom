import { prisma } from "@/db/client"
import { NotificationType } from "@/db/types"

export async function markNotificationAsRead(userId: number, notificationId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })
}

export async function markAllNotificationsAsRead(userId: number) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })
}

export function deleteNotificationByUserId(userId: number, notificationId: string) {
  return prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  })
}

export function deleteAllNotificationsByUserId(userId: number) {
  return prisma.notification.deleteMany({
    where: {
      userId,
    },
  })
}

export function deleteReadSystemNotifications() {
  return prisma.notification.deleteMany({
    where: {
      type: NotificationType.SYSTEM,
      isRead: true,
    },
  })
}
