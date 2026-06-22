import { PaymentApplicationStatus, PaymentTransactionStatus } from "@/db/types"
import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export const paymentApplicationPublicSelect = {
  id: true,
  ownerId: true,
  paymentId: true,
  name: true,
  description: true,
  homepageUrl: true,
  callbackUrl: true,
  status: true,
  reviewNote: true,
  reviewedById: true,
  reviewedAt: true,
  secretRotatedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      username: true,
      nickname: true,
      email: true,
      status: true,
      points: true,
    },
  },
  reviewer: {
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.PaymentApplicationSelect

export const paymentTransactionPublicSelect = {
  id: true,
  transactionId: true,
  applicationId: true,
  payerId: true,
  orderId: true,
  amount: true,
  platformFee: true,
  merchantPoints: true,
  description: true,
  status: true,
  errorMessage: true,
  paidAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  application: {
    select: paymentApplicationPublicSelect,
  },
  payer: {
    select: {
      id: true,
      username: true,
      nickname: true,
      status: true,
      points: true,
    },
  },
} satisfies Prisma.PaymentTransactionSelect

export function createPaymentApplicationRecord(data: Prisma.PaymentApplicationUncheckedCreateInput) {
  return prisma.paymentApplication.create({
    data,
    select: paymentApplicationPublicSelect,
  })
}

export function findPaymentApplicationsByOwner(ownerId: number, take = 50) {
  return prisma.paymentApplication.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(take, 100)),
    select: paymentApplicationPublicSelect,
  })
}

export function findPaymentApplicationByOwnerAndId(ownerId: number, id: string) {
  return prisma.paymentApplication.findFirst({
    where: { id, ownerId },
    select: paymentApplicationPublicSelect,
  })
}

export function findPaymentApplicationById(id: string) {
  return prisma.paymentApplication.findUnique({
    where: { id },
    select: paymentApplicationPublicSelect,
  })
}

export function findPaymentApplicationByPaymentId(paymentId: string) {
  return prisma.paymentApplication.findUnique({
    where: { paymentId },
    select: {
      ...paymentApplicationPublicSelect,
      secretHash: true,
    },
  })
}

export function findPaymentApplicationsForAdmin(options: {
  status?: PaymentApplicationStatus | "ALL"
  keyword?: string
  skip?: number
  take?: number
} = {}) {
  const keyword = options.keyword?.trim()
  const where: Prisma.PaymentApplicationWhereInput = {
    ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
            { homepageUrl: { contains: keyword, mode: "insensitive" } },
            { callbackUrl: { contains: keyword, mode: "insensitive" } },
            { paymentId: { contains: keyword, mode: "insensitive" } },
            { owner: { username: { contains: keyword, mode: "insensitive" } } },
            { owner: { nickname: { contains: keyword, mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  return prisma.paymentApplication.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" },
    ],
    skip: Math.max(0, options.skip ?? 0),
    take: Math.max(1, Math.min(options.take ?? 30, 100)),
    select: paymentApplicationPublicSelect,
  })
}

export function countPaymentApplicationsForAdmin(options: {
  status?: PaymentApplicationStatus | "ALL"
  keyword?: string
} = {}) {
  const keyword = options.keyword?.trim()
  const where: Prisma.PaymentApplicationWhereInput = {
    ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
            { homepageUrl: { contains: keyword, mode: "insensitive" } },
            { callbackUrl: { contains: keyword, mode: "insensitive" } },
            { paymentId: { contains: keyword, mode: "insensitive" } },
            { owner: { username: { contains: keyword, mode: "insensitive" } } },
            { owner: { nickname: { contains: keyword, mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  return prisma.paymentApplication.count({ where })
}

export function getPaymentApplicationSummary() {
  return prisma.paymentApplication.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
  })
}

function buildPaymentTransactionWhere(options: {
  ownerId?: number
  status?: PaymentTransactionStatus | "ALL"
  keyword?: string
} = {}): Prisma.PaymentTransactionWhereInput {
  const keyword = options.keyword?.trim()

  return {
    ...(typeof options.ownerId === "number"
      ? {
          application: {
            ownerId: options.ownerId,
          },
        }
      : {}),
    ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
    ...(keyword
      ? {
          OR: [
            { transactionId: { contains: keyword, mode: "insensitive" } },
            { orderId: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
            { application: { paymentId: { contains: keyword, mode: "insensitive" } } },
            { application: { name: { contains: keyword, mode: "insensitive" } } },
            { application: { owner: { username: { contains: keyword, mode: "insensitive" } } } },
            { application: { owner: { nickname: { contains: keyword, mode: "insensitive" } } } },
            { payer: { is: { username: { contains: keyword, mode: "insensitive" } } } },
            { payer: { is: { nickname: { contains: keyword, mode: "insensitive" } } } },
          ],
        }
      : {}),
  }
}

export function findPaymentTransactionsForAdmin(options: {
  ownerId?: number
  status?: PaymentTransactionStatus | "ALL"
  keyword?: string
  skip?: number
  take?: number
} = {}) {
  return prisma.paymentTransaction.findMany({
    where: buildPaymentTransactionWhere(options),
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip: Math.max(0, options.skip ?? 0),
    take: Math.max(1, Math.min(options.take ?? 20, 100)),
    select: paymentTransactionPublicSelect,
  })
}

export function countPaymentTransactionsForAdmin(options: {
  ownerId?: number
  status?: PaymentTransactionStatus | "ALL"
  keyword?: string
} = {}) {
  return prisma.paymentTransaction.count({
    where: buildPaymentTransactionWhere(options),
  })
}

export function getPaymentTransactionSummary(options: {
  ownerId?: number
} = {}) {
  return prisma.paymentTransaction.groupBy({
    by: ["status"],
    where: buildPaymentTransactionWhere({ ownerId: options.ownerId }),
    _count: {
      _all: true,
    },
    _sum: {
      amount: true,
      platformFee: true,
    },
  })
}

export function updatePaymentApplicationByOwner(params: {
  id: string
  ownerId: number
  data: Prisma.PaymentApplicationUncheckedUpdateInput
}) {
  return prisma.paymentApplication.updateMany({
    where: {
      id: params.id,
      ownerId: params.ownerId,
      status: {
        in: [PaymentApplicationStatus.PENDING, PaymentApplicationStatus.REJECTED],
      },
    },
    data: params.data,
  })
}

export function updatePaymentApplicationByAdmin(params: {
  id: string
  data: Prisma.PaymentApplicationUncheckedUpdateInput
}) {
  return prisma.paymentApplication.update({
    where: {
      id: params.id,
    },
    data: params.data,
    select: paymentApplicationPublicSelect,
  })
}

export function updatePaymentApplicationSecret(params: {
  id: string
  ownerId?: number
  secretHash: string
}) {
  return prisma.paymentApplication.updateMany({
    where: {
      id: params.id,
      ...(typeof params.ownerId === "number" ? { ownerId: params.ownerId } : {}),
    },
    data: {
      secretHash: params.secretHash,
      secretRotatedAt: new Date(),
    },
  })
}

export function updatePaymentApplicationReview(params: {
  id: string
  reviewerId: number
  status: PaymentApplicationStatus
  reviewNote?: string | null
}) {
  return prisma.paymentApplication.update({
    where: { id: params.id },
    data: {
      status: params.status,
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
      reviewNote: params.reviewNote?.trim() || null,
    },
    select: paymentApplicationPublicSelect,
  })
}

export function createPaymentTransactionRecord(data: Prisma.PaymentTransactionUncheckedCreateInput) {
  return prisma.paymentTransaction.create({
    data,
    select: paymentTransactionPublicSelect,
  })
}

export function findPaymentTransactionByApplicationAndOrder(applicationId: string, orderId: string) {
  return prisma.paymentTransaction.findUnique({
    where: {
      applicationId_orderId: {
        applicationId,
        orderId,
      },
    },
    select: paymentTransactionPublicSelect,
  })
}

export function findPaymentTransactionByTransactionId(transactionId: string) {
  return prisma.paymentTransaction.findUnique({
    where: { transactionId },
    select: paymentTransactionPublicSelect,
  })
}

export function findPaymentTransactionForApplication(paymentId: string, transactionId: string) {
  return prisma.paymentTransaction.findFirst({
    where: {
      transactionId,
      application: {
        paymentId,
      },
    },
    select: paymentTransactionPublicSelect,
  })
}

export function markPaymentTransactionFailed(params: {
  transactionId: string
  errorMessage: string
}) {
  return prisma.paymentTransaction.updateMany({
    where: {
      transactionId: params.transactionId,
      status: {
        in: ["PENDING", "PROCESSING"],
      },
    },
    data: {
      status: "FAILED",
      errorMessage: params.errorMessage,
    },
  })
}

export function isPaymentApplicationUsable(status: PaymentApplicationStatus) {
  return status === PaymentApplicationStatus.ACTIVE
}
