import { prisma } from "@/db/client"
import { createSystemNotification as createSystemNotificationEntry } from "@/lib/notification-writes"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"

import type { SelfServeAdOrderStatus, SelfServeAdSlotType } from "@/lib/self-serve-ads.shared"

export function submitSelfServeAdOrderTransaction(data: {
  orderId: string
  userId: number
  appCode: string
  slotType: SelfServeAdSlotType
  slotIndex: number
  title: string | null
  linkUrl: string
  imageUrl: string | null
  textColor: string | null
  backgroundColor: string | null
  durationMonths: number
  pricePoints: number
  pointReason: string
}) {
  return prepareScopedPointDelta({
    scopeKey: "SELF_SERVE_AD_PURCHASE",
    baseDelta: -data.pricePoints,
    userId: data.userId,
  }).then((preparedPurchase) => prisma.$transaction(async (tx) => {
    const latestUser = await tx.user.findUnique({
      where: { id: data.userId },
      select: { id: true, points: true },
    })

    if (!latestUser) {
      throw new Error("用户不存在")
    }

    if (preparedPurchase.finalDelta < 0 && latestUser.points < Math.abs(preparedPurchase.finalDelta)) {
      return { error: "POINTS_NOT_ENOUGH" as const }
    }

    await applyPointDelta({
      tx,
      userId: latestUser.id,
      beforeBalance: latestUser.points,
      prepared: preparedPurchase,
      pointName: "积分",
      insufficientMessage: "积分不足，无法提交广告订单",
      reason: data.pointReason,
    })

    const order = await tx.selfServeAdOrder.create({
      data: {
        id: data.orderId,
        appCode: data.appCode,
        userId: latestUser.id,
        slotType: data.slotType,
        slotIndex: data.slotIndex,
        title: data.title,
        linkUrl: data.linkUrl,
        imageUrl: data.imageUrl,
        textColor: data.textColor,
        backgroundColor: data.backgroundColor,
        durationMonths: data.durationMonths,
        pricePoints: Math.max(0, -preparedPurchase.finalDelta),
        status: "PENDING",
      },
    })

    return { error: null as null, order }
  }))
}

export function createSystemNotification(data: {
  userId: number
  relatedId: string
  title: string
  content: string
}) {
  return createSystemNotificationEntry({
    userId: data.userId,
    relatedId: data.relatedId,
    title: data.title,
    content: data.content,
  })
}

export function updateSelfServeAdOrderStatus(id: string, data: {
  title?: string | null
  linkUrl?: string
  imageUrl?: string | null
  textColor?: string | null
  backgroundColor?: string | null
  durationMonths?: number
  pricePoints?: number
  status?: SelfServeAdOrderStatus
  reviewNote?: string | null
  startsAt?: Date | null
  endsAt?: Date | null
  slotIndex?: number
}) {
  return prisma.selfServeAdOrder.update({
    where: { id },
    data,
  })
}
