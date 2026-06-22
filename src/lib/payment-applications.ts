import { createHmac, timingSafeEqual } from "node:crypto"

import { PaymentApplicationStatus, PaymentTransactionStatus, type Prisma, type UserStatus } from "@/db/types"

import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { prisma } from "@/db/client"
import {
  countPaymentApplicationsForAdmin,
  countPaymentTransactionsForAdmin,
  createPaymentApplicationRecord,
  createPaymentTransactionRecord,
  findPaymentApplicationById,
  findPaymentApplicationByOwnerAndId,
  findPaymentApplicationByPaymentId,
  findPaymentApplicationsByOwner,
  findPaymentApplicationsForAdmin,
  findPaymentTransactionsForAdmin,
  findPaymentTransactionByApplicationAndOrder,
  findPaymentTransactionByTransactionId,
  findPaymentTransactionForApplication,
  getPaymentApplicationSummary,
  getPaymentTransactionSummary,
  isPaymentApplicationUsable,
  updatePaymentApplicationByAdmin as updatePaymentApplicationByAdminRecord,
  updatePaymentApplicationByOwner,
  updatePaymentApplicationReview,
  updatePaymentApplicationSecret,
} from "@/db/payment-application-queries"
import { apiError } from "@/lib/api-route"
import { getUserDisplayName } from "@/lib/user-display"
import { createOAuthOpaqueToken, hashOAuthToken } from "@/lib/oauth-utils"
import { getServerSiteSettings } from "@/lib/site-settings"
import { normalizePageSize, normalizePositiveInteger, normalizeTrimmedText } from "@/lib/shared/normalizers"
import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"
import { normalizeHttpUrl } from "@/lib/shared/url"
import { applyPointDelta, type PreparedPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { createSystemNotification } from "@/lib/notification-writes"

const PAYMENT_APPLICATION_NAME_MAX_LENGTH = 80
const PAYMENT_APPLICATION_DESCRIPTION_MAX_LENGTH = 500
const PAYMENT_APPLICATION_URL_MAX_LENGTH = 500
const PAYMENT_APPLICATION_REVIEW_NOTE_MAX_LENGTH = 1000
const PAYMENT_ORDER_ID_MAX_LENGTH = 128
const PAYMENT_TRANSACTION_DESCRIPTION_MAX_LENGTH = 500
const PAYMENT_TRANSACTION_TTL_MS = 30 * 60 * 1000

export class PaymentApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "PaymentApiError"
    this.status = status
  }
}

type PaymentApplicationRecord = NonNullable<Awaited<ReturnType<typeof findPaymentApplicationByPaymentId>>>
type PaymentApplicationPublicRecord = NonNullable<Awaited<ReturnType<typeof findPaymentApplicationById>>>
type PaymentTransactionRecord = NonNullable<Awaited<ReturnType<typeof findPaymentTransactionByTransactionId>>>

export interface PaymentApplicationListItem {
  id: string
  paymentId: string
  name: string
  description: string
  homepageUrl: string
  callbackUrl: string
  status: PaymentApplicationStatus
  reviewNote: string
  reviewedAt: string | null
  secretRotatedAt: string | null
  createdAt: string
  updatedAt: string
  owner?: {
    id: number
    username: string
    displayName: string
    email: string | null
    status: UserStatus
  }
  reviewer?: {
    id: number
    username: string
    displayName: string
  } | null
}

export interface PaymentApplicationResult {
  application: PaymentApplicationListItem
  secretKey: string
}

export type ExternalPaymentStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "refunded"

export interface PaymentTransactionListItem {
  id: string
  transactionId: string
  externalReference: string
  amount: number
  platformFee: number
  description: string
  status: PaymentTransactionStatus
  externalStatus: ExternalPaymentStatus
  expired: boolean
  errorMessage: string
  paidAt: string | null
  expiresAt: string
  createdAt: string
  updatedAt: string
  application: {
    id: string
    paymentId: string
    name: string
    owner?: {
      id: number
      username: string
      displayName: string
      status: UserStatus
    }
  }
  payer: {
    id: number
    username: string
    displayName: string
    status: UserStatus
  } | null
}

export interface PaymentTransactionPageData {
  transactions: PaymentTransactionListItem[]
  filters: {
    keyword: string
    status: "ALL" | PaymentTransactionStatus
    page: number
    pageSize: number
  }
  summary: {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
    cancelled: number
    refunded: number
    totalAmount: number
    totalPlatformFee: number
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

export interface PaymentApplicationPageData {
  enabled: boolean
  applications: PaymentApplicationListItem[]
  transactions: PaymentTransactionPageData
}

export interface PaymentApplicationAdminPageData {
  applications: PaymentApplicationListItem[]
  transactions: PaymentTransactionPageData
  filters: {
    keyword: string
    status: "ALL" | PaymentApplicationStatus
    page: number
    pageSize: number
  }
  summary: {
    total: number
    pending: number
    active: number
    rejected: number
    disabled: number
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

export interface ExternalPaymentCheckoutResponse {
  payment_url: string
  transaction_id: string
  status: ExternalPaymentStatus
  amount: number
}

export interface ExternalPaymentQueryResponse {
  transaction_id: string
  status: ExternalPaymentStatus
  amount: number
  platform_fee: number
  description: string
  external_reference: string
  created_at: string
  updated_at: string
  paid_at: string | null
  expires_at: string
  expired: boolean
  error_message: string | null
}

export interface PaymentCheckoutPageData {
  transactionId: string
  externalReference: string
  status: ExternalPaymentStatus
  expired: boolean
  amount: number
  platformFee: number
  description: string
  createdAt: string
  expiresAt: string
  paidAt: string | null
  callbackUrl: string | null
  application: {
    paymentId: string
    name: string
    description: string
    homepageUrl: string
    callbackUrl: string
    ownerDisplayName: string
  }
  payer: {
    id: number
    displayName: string
    username: string
  } | null
}

function throwPaymentApiError(status: number, message: string): never {
  throw new PaymentApiError(status, message)
}

function ensurePaymentApplicationEnabled(settings: Awaited<ReturnType<typeof getServerSiteSettings>>) {
  if (!settings.paymentApplicationEnabled) {
    apiError(403, "当前站点未开启 Payment 功能")
  }
}

function normalizeOptionalUrl(value: unknown) {
  const raw = normalizeTrimmedText(value, PAYMENT_APPLICATION_URL_MAX_LENGTH)
  if (!raw) {
    return null
  }

  return normalizeHttpUrl(raw, { allowCredentials: false, clearHash: true })
}

function normalizeRequiredUrl(value: unknown, message: string) {
  const normalized = normalizeOptionalUrl(value)
  if (!normalized) {
    apiError(400, message)
  }

  return normalized
}

function ensurePaymentApplicationPayload(input: {
  name: unknown
  description?: unknown
  homepageUrl?: unknown
  callbackUrl: unknown
}) {
  const name = normalizeTrimmedText(input.name, PAYMENT_APPLICATION_NAME_MAX_LENGTH)
  const description = normalizeTrimmedText(input.description, PAYMENT_APPLICATION_DESCRIPTION_MAX_LENGTH) || null
  const homepageUrl = normalizeOptionalUrl(input.homepageUrl)
  const callbackUrl = normalizeRequiredUrl(input.callbackUrl, "回调地址格式不正确")

  if (!name) {
    apiError(400, "应用名称不能为空")
  }

  if (input.homepageUrl && !homepageUrl) {
    apiError(400, "网站地址格式不正确")
  }

  return {
    name,
    description,
    homepageUrl,
    callbackUrl,
  }
}

function createPaymentCredentials() {
  const paymentId = createOAuthOpaqueToken("pay", 18)
  const secretKey = createOAuthOpaqueToken("tk", 36)

  return {
    paymentId,
    secretKey,
    secretHash: hashOAuthToken(secretKey),
  }
}

function mapPaymentApplication(item: PaymentApplicationPublicRecord | PaymentApplicationRecord): PaymentApplicationListItem {
  return {
    id: item.id,
    paymentId: item.paymentId,
    name: item.name,
    description: item.description ?? "",
    homepageUrl: item.homepageUrl ?? "",
    callbackUrl: item.callbackUrl,
    status: item.status,
    reviewNote: item.reviewNote ?? "",
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    secretRotatedAt: item.secretRotatedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    owner: item.owner
      ? {
          id: item.owner.id,
          username: item.owner.username,
          displayName: getUserDisplayName(item.owner),
          email: item.owner.email ?? null,
          status: item.owner.status,
        }
      : undefined,
    reviewer: item.reviewer
      ? {
          id: item.reviewer.id,
          username: item.reviewer.username,
          displayName: getUserDisplayName(item.reviewer),
        }
      : null,
  }
}

function mapPaymentTransaction(item: PaymentTransactionRecord): PaymentTransactionListItem {
  return {
    id: item.id,
    transactionId: item.transactionId,
    externalReference: item.orderId,
    amount: item.amount,
    platformFee: item.platformFee,
    description: item.description,
    status: item.status,
    externalStatus: getExternalPaymentStatus(item),
    expired: isPaymentTransactionExpired(item),
    errorMessage: item.errorMessage ?? "",
    paidAt: item.paidAt?.toISOString() ?? null,
    expiresAt: item.expiresAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    application: {
      id: item.application.id,
      paymentId: item.application.paymentId,
      name: item.application.name,
      owner: item.application.owner
        ? {
            id: item.application.owner.id,
            username: item.application.owner.username,
            displayName: getUserDisplayName(item.application.owner),
            status: item.application.owner.status,
          }
        : undefined,
    },
    payer: item.payer
      ? {
          id: item.payer.id,
          username: item.payer.username,
          displayName: getUserDisplayName(item.payer),
          status: item.payer.status,
        }
      : null,
  }
}

function normalizePaymentTransactionStatus(value: unknown): "ALL" | PaymentTransactionStatus {
  if (
    value === PaymentTransactionStatus.PENDING
    || value === PaymentTransactionStatus.PROCESSING
    || value === PaymentTransactionStatus.COMPLETED
    || value === PaymentTransactionStatus.FAILED
    || value === PaymentTransactionStatus.CANCELLED
    || value === PaymentTransactionStatus.REFUNDED
  ) {
    return value
  }

  return "ALL"
}

async function getPaymentTransactionPageData(input: {
  ownerId?: number
  keyword?: unknown
  status?: unknown
  page?: unknown
  pageSize?: unknown
} = {}): Promise<PaymentTransactionPageData> {
  const keyword = normalizeTrimmedText(input.keyword, 100)
  const status = normalizePaymentTransactionStatus(input.status)
  const pageSize = normalizePageSize(input.pageSize, [10, 20, 50, 100], 10)
  const requestedPage = normalizePositiveInteger(input.page, 1)
  const [total, summaryRows] = await Promise.all([
    countPaymentTransactionsForAdmin({
      ownerId: input.ownerId,
      keyword,
      status,
    }),
    getPaymentTransactionSummary({
      ownerId: input.ownerId,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const transactions = await findPaymentTransactionsForAdmin({
    ownerId: input.ownerId,
    keyword,
    status,
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
  const summary = {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    refunded: 0,
    totalAmount: 0,
    totalPlatformFee: 0,
  }

  for (const row of summaryRows) {
    const count = row._count._all
    summary.total += count
    summary.totalAmount += row._sum.amount ?? 0
    summary.totalPlatformFee += row._sum.platformFee ?? 0

    if (row.status === PaymentTransactionStatus.PENDING) {
      summary.pending += count
    } else if (row.status === PaymentTransactionStatus.PROCESSING) {
      summary.processing += count
    } else if (row.status === PaymentTransactionStatus.COMPLETED) {
      summary.completed += count
    } else if (row.status === PaymentTransactionStatus.FAILED) {
      summary.failed += count
    } else if (row.status === PaymentTransactionStatus.CANCELLED) {
      summary.cancelled += count
    } else if (row.status === PaymentTransactionStatus.REFUNDED) {
      summary.refunded += count
    }
  }

  return {
    transactions: transactions.map(mapPaymentTransaction),
    filters: {
      keyword,
      status,
      page,
      pageSize,
    },
    summary,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}

async function executePaymentApplicationChangedHook(input: {
  action: "create" | "resubmit" | "admin-update" | "review" | "rotate-secret"
  application: PaymentApplicationPublicRecord | PaymentApplicationRecord
  actorUserId?: number
  previousStatus?: PaymentApplicationStatus
  reviewAction?: "approve" | "reject" | "disable"
}) {
  await executeAddonActionHook("payment.application.changed", {
    action: input.action,
    applicationId: input.application.id,
    paymentId: input.application.paymentId,
    ownerId: input.application.ownerId,
    actorUserId: input.actorUserId,
    name: input.application.name,
    homepageUrl: input.application.homepageUrl,
    callbackUrl: input.application.callbackUrl,
    status: input.application.status,
    previousStatus: input.previousStatus,
    nextStatus: input.application.status,
    reviewAction: input.reviewAction,
    reviewedById: input.application.reviewedById,
    occurredAt: new Date().toISOString(),
  })
}

async function executePaymentTransactionCreatedHook(transaction: PaymentTransactionRecord) {
  await executeAddonActionHook("payment.transaction.created", {
    transactionId: transaction.transactionId,
    applicationId: transaction.application.id,
    paymentId: transaction.application.paymentId,
    ownerId: transaction.application.ownerId,
    externalReference: transaction.orderId,
    amount: transaction.amount,
    platformFee: transaction.platformFee,
    description: transaction.description,
    status: transaction.status,
    expiresAt: transaction.expiresAt.toISOString(),
    occurredAt: new Date().toISOString(),
  })
}

export async function getPaymentApplicationPageData(ownerId: number, input: {
  transactionKeyword?: unknown
  transactionStatus?: unknown
  transactionPage?: unknown
  transactionPageSize?: unknown
} = {}): Promise<PaymentApplicationPageData> {
  const [settings, applications, transactions] = await Promise.all([
    getServerSiteSettings(),
    findPaymentApplicationsByOwner(ownerId),
    getPaymentTransactionPageData({
      ownerId,
      keyword: input.transactionKeyword,
      status: input.transactionStatus,
      page: input.transactionPage,
      pageSize: input.transactionPageSize,
    }),
  ])

  return {
    enabled: settings.paymentApplicationEnabled,
    applications: applications.map(mapPaymentApplication),
    transactions,
  }
}

export async function createOwnPaymentApplication(input: {
  ownerId: number
  name: unknown
  description?: unknown
  homepageUrl?: unknown
  callbackUrl: unknown
}): Promise<PaymentApplicationResult> {
  ensurePaymentApplicationEnabled(await getServerSiteSettings())

  const payload = ensurePaymentApplicationPayload(input)
  const credentials = createPaymentCredentials()
  const application = await createPaymentApplicationRecord({
    ownerId: input.ownerId,
    paymentId: credentials.paymentId,
    secretHash: credentials.secretHash,
    name: payload.name,
    description: payload.description,
    homepageUrl: payload.homepageUrl,
    callbackUrl: payload.callbackUrl,
    status: PaymentApplicationStatus.PENDING,
  })
  await executePaymentApplicationChangedHook({
    action: "create",
    application,
    actorUserId: input.ownerId,
  })

  return {
    application: mapPaymentApplication(application),
    secretKey: credentials.secretKey,
  }
}

export async function updateOwnPaymentApplication(input: {
  ownerId: number
  id: string
  name: unknown
  description?: unknown
  homepageUrl?: unknown
  callbackUrl: unknown
}) {
  ensurePaymentApplicationEnabled(await getServerSiteSettings())

  const existing = await findPaymentApplicationByOwnerAndId(input.ownerId, input.id)
  if (!existing) {
    apiError(404, "Payment 应用不存在")
  }

  if (existing.status !== PaymentApplicationStatus.PENDING && existing.status !== PaymentApplicationStatus.REJECTED) {
    apiError(400, "只有待审核或已驳回的 Payment 应用可以由申请人修改")
  }

  const payload = ensurePaymentApplicationPayload(input)
  const updated = await updatePaymentApplicationByOwner({
    id: input.id,
    ownerId: input.ownerId,
    data: {
      ...payload,
      status: PaymentApplicationStatus.PENDING,
      reviewNote: null,
      reviewedById: null,
      reviewedAt: null,
    },
  })

  if (updated.count !== 1) {
    apiError(409, "应用状态已变化，请刷新后重试")
  }

  const updatedApplication = await findPaymentApplicationById(input.id)
  if (updatedApplication) {
    await executePaymentApplicationChangedHook({
      action: "resubmit",
      application: updatedApplication,
      actorUserId: input.ownerId,
      previousStatus: existing.status,
    })
  }
}

export async function rotateOwnPaymentApplicationSecret(input: {
  ownerId: number
  id: string
}) {
  ensurePaymentApplicationEnabled(await getServerSiteSettings())

  const existing = await findPaymentApplicationByOwnerAndId(input.ownerId, input.id)
  if (!existing) {
    apiError(404, "Payment 应用不存在")
  }

  const secretKey = createOAuthOpaqueToken("tk", 36)
  const updated = await updatePaymentApplicationSecret({
    id: input.id,
    ownerId: input.ownerId,
    secretHash: hashOAuthToken(secretKey),
  })

  if (updated.count !== 1) {
    apiError(409, "应用状态已变化，请刷新后重试")
  }

  await executePaymentApplicationChangedHook({
    action: "rotate-secret",
    application: existing,
    actorUserId: input.ownerId,
    previousStatus: existing.status,
  })

  return { secretKey }
}

function normalizeAdminPaymentStatus(value: unknown): "ALL" | PaymentApplicationStatus {
  if (
    value === PaymentApplicationStatus.PENDING
    || value === PaymentApplicationStatus.ACTIVE
    || value === PaymentApplicationStatus.REJECTED
    || value === PaymentApplicationStatus.DISABLED
  ) {
    return value
  }

  return "ALL"
}

export async function getAdminPaymentApplicationPageData(input: {
  keyword?: unknown
  status?: unknown
  page?: unknown
  pageSize?: unknown
  orderKeyword?: unknown
  orderStatus?: unknown
  orderPage?: unknown
  orderPageSize?: unknown
} = {}): Promise<PaymentApplicationAdminPageData> {
  const keyword = normalizeTrimmedText(input.keyword, 100)
  const status = normalizeAdminPaymentStatus(input.status)
  const pageSize = normalizePageSize(input.pageSize, [20, 50, 100], 20)
  const requestedPage = normalizePositiveInteger(input.page, 1)
  const [total, summaryRows, transactions] = await Promise.all([
    countPaymentApplicationsForAdmin({ keyword, status }),
    getPaymentApplicationSummary(),
    getPaymentTransactionPageData({
      keyword: input.orderKeyword,
      status: input.orderStatus,
      page: input.orderPage,
      pageSize: input.orderPageSize,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const applications = await findPaymentApplicationsForAdmin({
    keyword,
    status,
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
  const summary = {
    total: 0,
    pending: 0,
    active: 0,
    rejected: 0,
    disabled: 0,
  }

  for (const row of summaryRows) {
    summary.total += row._count._all
    if (row.status === PaymentApplicationStatus.PENDING) {
      summary.pending += row._count._all
    } else if (row.status === PaymentApplicationStatus.ACTIVE) {
      summary.active += row._count._all
    } else if (row.status === PaymentApplicationStatus.REJECTED) {
      summary.rejected += row._count._all
    } else if (row.status === PaymentApplicationStatus.DISABLED) {
      summary.disabled += row._count._all
    }
  }

  return {
    applications: applications.map(mapPaymentApplication),
    transactions,
    filters: {
      keyword,
      status,
      page,
      pageSize,
    },
    summary,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}

export async function reviewPaymentApplication(input: {
  id: string
  reviewerId: number
  action: "approve" | "reject" | "disable"
  reviewNote?: unknown
}) {
  const application = await findPaymentApplicationById(input.id)
  if (!application) {
    apiError(404, "Payment 应用不存在")
  }

  const reviewNote = normalizeTrimmedText(input.reviewNote, PAYMENT_APPLICATION_REVIEW_NOTE_MAX_LENGTH) || null
  const nextStatus = input.action === "approve"
    ? PaymentApplicationStatus.ACTIVE
    : input.action === "reject"
      ? PaymentApplicationStatus.REJECTED
      : PaymentApplicationStatus.DISABLED

  if (input.action === "approve" && application.status !== PaymentApplicationStatus.PENDING) {
    apiError(400, "只有待审核 Payment 应用可以通过")
  }

  if (input.action === "reject" && application.status !== PaymentApplicationStatus.PENDING) {
    apiError(400, "只有待审核 Payment 应用可以驳回")
  }

  if (input.action === "disable" && application.status !== PaymentApplicationStatus.ACTIVE) {
    apiError(400, "只有已通过 Payment 应用可以禁用")
  }

  const updated = await updatePaymentApplicationReview({
    id: input.id,
    reviewerId: input.reviewerId,
    status: nextStatus,
    reviewNote,
  })

  await createSystemNotification({
    userId: updated.ownerId,
    senderId: input.reviewerId,
    relatedType: "ANNOUNCEMENT",
    relatedId: updated.id,
    title: input.action === "approve"
      ? "你的 Payment 应用已通过审核"
      : input.action === "reject"
        ? "你的 Payment 应用未通过审核"
        : "你的 Payment 应用已被禁用",
    content: input.action === "approve"
      ? `你提交的 Payment 应用“${updated.name}”已通过审核，现在可以用于第三方积分支付收款。`
      : input.action === "reject"
        ? `你提交的 Payment 应用“${updated.name}”未通过审核。${reviewNote ? `审核备注：${reviewNote}` : "请修改后重新提交。"}`
        : `你的 Payment 应用“${updated.name}”已被管理员禁用。${reviewNote ? `原因：${reviewNote}` : ""}`,
    url: "/settings?tab=oauth-apps",
  })
  await executePaymentApplicationChangedHook({
    action: "review",
    application: updated,
    actorUserId: input.reviewerId,
    previousStatus: application.status,
    reviewAction: input.action,
  })

  return mapPaymentApplication(updated)
}

export async function rotatePaymentApplicationSecretByAdmin(input: {
  id: string
}) {
  const existing = await findPaymentApplicationById(input.id)
  if (!existing) {
    apiError(404, "Payment 应用不存在")
  }

  const secretKey = createOAuthOpaqueToken("tk", 36)
  const updated = await updatePaymentApplicationSecret({
    id: input.id,
    secretHash: hashOAuthToken(secretKey),
  })

  if (updated.count !== 1) {
    apiError(404, "Payment 应用不存在")
  }

  await executePaymentApplicationChangedHook({
    action: "rotate-secret",
    application: existing,
    previousStatus: existing.status,
  })

  return { secretKey }
}

export async function updatePaymentApplicationByAdmin(input: {
  id: string
  name: unknown
  description?: unknown
  homepageUrl?: unknown
  callbackUrl: unknown
}) {
  const id = normalizeTrimmedText(input.id, 200)
  if (!id) {
    apiError(400, "缺少 Payment 应用 ID")
  }

  const existing = await findPaymentApplicationById(id)
  if (!existing) {
    apiError(404, "Payment 应用不存在")
  }

  const payload = ensurePaymentApplicationPayload(input)
  const updated = await updatePaymentApplicationByAdminRecord({
    id,
    data: payload,
  })
  await executePaymentApplicationChangedHook({
    action: "admin-update",
    application: updated,
    previousStatus: existing.status,
  })

  return mapPaymentApplication(updated)
}

function normalizeExternalPaymentInput(input: {
  amount: unknown
  description: unknown
  orderId: unknown
}) {
  const amount = parsePositiveSafeInteger(input.amount)
  const description = normalizeTrimmedText(input.description, PAYMENT_TRANSACTION_DESCRIPTION_MAX_LENGTH)
  const orderId = normalizeTrimmedText(input.orderId, PAYMENT_ORDER_ID_MAX_LENGTH)

  if (!amount) {
    throwPaymentApiError(400, "Invalid amount")
  }

  if (!description) {
    throwPaymentApiError(400, "Missing description")
  }

  if (!orderId) {
    throwPaymentApiError(400, "Missing order_id")
  }

  return {
    amount,
    description,
    orderId,
  }
}

export function buildPaymentSignaturePayload(params: Record<string, string | number | null | undefined>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&")
}

export function signPaymentParams(secretHash: string, params: Record<string, string | number | null | undefined>) {
  const payload = buildPaymentSignaturePayload(params)
  return createHmac("sha256", secretHash).update(payload, "utf8").digest("hex")
}

export function verifyPaymentSignature(input: {
  secretHash: string
  params: Record<string, string | number | null | undefined>
  signature: unknown
}) {
  const signature = normalizeTrimmedText(input.signature, 256).toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    return false
  }

  const expected = signPaymentParams(input.secretHash, input.params)
  const left = Buffer.from(expected, "utf8")
  const right = Buffer.from(signature, "utf8")
  return left.length === right.length && timingSafeEqual(left, right)
}

function getExternalPaymentStatus(transaction: {
  status: PaymentTransactionStatus
  expiresAt: Date
}): ExternalPaymentStatus {
  if (transaction.status === PaymentTransactionStatus.PENDING && transaction.expiresAt.getTime() <= Date.now()) {
    return "cancelled"
  }

  return transaction.status.toLowerCase() as ExternalPaymentStatus
}

function isPaymentTransactionExpired(transaction: {
  status: PaymentTransactionStatus
  expiresAt: Date
}) {
  return transaction.status === PaymentTransactionStatus.PENDING && transaction.expiresAt.getTime() <= Date.now()
}

function buildPaymentUrl(baseUrl: string, transactionId: string) {
  return new URL(`/payment/pay/${encodeURIComponent(transactionId)}`, baseUrl).toString()
}

function toCheckoutResponse(input: {
  transaction: PaymentTransactionRecord
  baseUrl: string
}): ExternalPaymentCheckoutResponse {
  return {
    payment_url: buildPaymentUrl(input.baseUrl, input.transaction.transactionId),
    transaction_id: input.transaction.transactionId,
    status: getExternalPaymentStatus(input.transaction),
    amount: input.transaction.amount,
  }
}

function toQueryResponse(transaction: PaymentTransactionRecord): ExternalPaymentQueryResponse {
  return {
    transaction_id: transaction.transactionId,
    status: getExternalPaymentStatus(transaction),
    amount: transaction.amount,
    platform_fee: transaction.platformFee,
    description: transaction.description,
    external_reference: transaction.orderId,
    created_at: transaction.createdAt.toISOString(),
    updated_at: transaction.updatedAt.toISOString(),
    paid_at: transaction.paidAt?.toISOString() ?? null,
    expires_at: transaction.expiresAt.toISOString(),
    expired: isPaymentTransactionExpired(transaction),
    error_message: transaction.errorMessage,
  }
}

async function requireUsablePaymentApplication(paymentId: unknown): Promise<PaymentApplicationRecord> {
  const normalizedPaymentId = normalizeTrimmedText(paymentId, 200)
  if (!normalizedPaymentId) {
    throwPaymentApiError(400, "Missing payment_id")
  }

  const [settings, application] = await Promise.all([
    getServerSiteSettings(),
    findPaymentApplicationByPaymentId(normalizedPaymentId),
  ])
  if (!settings.paymentApplicationEnabled) {
    throwPaymentApiError(403, "Payment is disabled")
  }

  if (!application) {
    throwPaymentApiError(404, "Payment application not found")
  }

  if (!isPaymentApplicationUsable(application.status)) {
    throwPaymentApiError(403, "Payment application is not approved")
  }

  return application
}

function calculatePaymentPlatformFee(amount: number, percent: number) {
  const normalizedPercent = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, Math.floor(percent)))
    : 0

  return Math.min(amount, Math.floor(amount * normalizedPercent / 100))
}

export async function createExternalPaymentTransaction(input: {
  paymentId: unknown
  amount: unknown
  description: unknown
  orderId: unknown
  signature: unknown
  baseUrl: string
}) {
  const application = await requireUsablePaymentApplication(input.paymentId)
  const payload = normalizeExternalPaymentInput(input)
  const signatureParams = {
    amount: payload.amount,
    description: payload.description,
    order_id: payload.orderId,
  }

  if (!verifyPaymentSignature({ secretHash: application.secretHash, params: signatureParams, signature: input.signature })) {
    throwPaymentApiError(401, "Invalid signature")
  }

  const existing = await findPaymentTransactionByApplicationAndOrder(application.id, payload.orderId)
  if (existing) {
    return toCheckoutResponse({ transaction: existing, baseUrl: input.baseUrl })
  }

  const settings = await getServerSiteSettings()
  const platformFee = calculatePaymentPlatformFee(payload.amount, settings.paymentPlatformFeePercent)
  const merchantPoints = Math.max(0, payload.amount - platformFee)
  const transaction = await createPaymentTransactionRecord({
    transactionId: createOAuthOpaqueToken("txn", 18),
    applicationId: application.id,
    orderId: payload.orderId,
    amount: payload.amount,
    platformFee,
    merchantPoints,
    description: payload.description,
    status: PaymentTransactionStatus.PENDING,
    expiresAt: new Date(Date.now() + PAYMENT_TRANSACTION_TTL_MS),
  })
  await executePaymentTransactionCreatedHook(transaction)

  return toCheckoutResponse({ transaction, baseUrl: input.baseUrl })
}

export async function queryExternalPaymentTransaction(input: {
  paymentId: unknown
  transactionId: unknown
  signature: unknown
}) {
  const application = await requireUsablePaymentApplication(input.paymentId)
  const transactionId = normalizeTrimmedText(input.transactionId, 200)
  if (!transactionId) {
    throwPaymentApiError(400, "Missing transaction_id")
  }

  if (!verifyPaymentSignature({
    secretHash: application.secretHash,
    params: { transaction_id: transactionId },
    signature: input.signature,
  })) {
    throwPaymentApiError(401, "Invalid signature")
  }

  const transaction = await findPaymentTransactionForApplication(application.paymentId, transactionId)
  if (!transaction) {
    throwPaymentApiError(404, "Transaction not found")
  }

  return toQueryResponse(transaction)
}

function pointDelta(scopeKey: PreparedPointDelta["scopeKey"], baseDelta: number): PreparedPointDelta {
  return {
    scopeKey,
    baseDelta,
    finalDelta: baseDelta,
    appliedRules: [],
  }
}

function buildPaymentPointEventData(transaction: {
  transactionId: string
  orderId: string
  amount: number
  platformFee: number
  merchantPoints: number
  application: {
    paymentId: string
    name: string
    ownerId: number
  }
}) {
  return {
    transactionId: transaction.transactionId,
    paymentId: transaction.application.paymentId,
    applicationName: transaction.application.name,
    externalReference: transaction.orderId,
    amount: transaction.amount,
    platformFee: transaction.platformFee,
    merchantPoints: transaction.merchantPoints,
    merchantUserId: transaction.application.ownerId,
  } satisfies Prisma.InputJsonValue
}

export function buildPaymentCallbackUrl(input: {
  transaction: {
    transactionId: string
    orderId: string
    amount: number
    platformFee: number
    paidAt: Date | null
  }
  callbackUrl: string
  secretHash: string
}) {
  if (!input.transaction.paidAt) {
    return null
  }

  const params = {
    transaction_id: input.transaction.transactionId,
    external_reference: input.transaction.orderId,
    amount: input.transaction.amount,
    platform_fee: input.transaction.platformFee,
    status: "completed",
    paid_at: input.transaction.paidAt.toISOString(),
  }
  const url = new URL(input.callbackUrl)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  url.searchParams.set("signature", signPaymentParams(input.secretHash, params))

  return url.toString()
}

export async function buildPaymentTransactionCallbackUrl(transactionId: string) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { transactionId },
    select: {
      transactionId: true,
      orderId: true,
      amount: true,
      platformFee: true,
      paidAt: true,
      application: {
        select: {
          callbackUrl: true,
          secretHash: true,
        },
      },
    },
  })

  if (!transaction) {
    return null
  }

  return buildPaymentCallbackUrl({
    transaction,
    callbackUrl: transaction.application.callbackUrl,
    secretHash: transaction.application.secretHash,
  })
}

export async function confirmPaymentTransaction(input: {
  transactionId: string
  payerId: number
}) {
  const transactionId = normalizeTrimmedText(input.transactionId, 200)
  if (!transactionId) {
    apiError(400, "缺少交易 ID")
  }

  const settings = await getServerSiteSettings()
  if (!settings.paymentApplicationEnabled) {
    apiError(403, "当前站点未开启 Payment 功能")
  }

  const completed = await prisma.$transaction(async (tx) => {
    const transaction = await tx.paymentTransaction.findUnique({
      where: { transactionId },
      select: {
        id: true,
        transactionId: true,
        orderId: true,
        amount: true,
        platformFee: true,
        merchantPoints: true,
        description: true,
        status: true,
        expiresAt: true,
        paidAt: true,
        application: {
          select: {
            id: true,
            paymentId: true,
            name: true,
            status: true,
            callbackUrl: true,
            secretHash: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                username: true,
                nickname: true,
                status: true,
                points: true,
              },
            },
          },
        },
      },
    })

    if (!transaction) {
      apiError(404, "支付订单不存在")
    }

    if (transaction.status === PaymentTransactionStatus.COMPLETED) {
      return transaction
    }

    if (transaction.status !== PaymentTransactionStatus.PENDING) {
      apiError(400, "当前支付订单无法继续支付")
    }

    if (!isPaymentApplicationUsable(transaction.application.status)) {
      apiError(403, "Payment 应用未通过审核或已被禁用")
    }

    if (transaction.expiresAt.getTime() <= Date.now()) {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentTransactionStatus.CANCELLED,
          errorMessage: "Payment expired",
        },
      })
      apiError(400, "支付订单已过期")
    }

    const locked = await tx.paymentTransaction.updateMany({
      where: {
        id: transaction.id,
        status: PaymentTransactionStatus.PENDING,
      },
      data: {
        status: PaymentTransactionStatus.PROCESSING,
        payerId: input.payerId,
      },
    })

    if (locked.count !== 1) {
      apiError(409, "支付订单状态已变化，请刷新后重试")
    }

    const [payer, merchant] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.payerId },
        select: {
          id: true,
          username: true,
          nickname: true,
          status: true,
          points: true,
        },
      }),
      tx.user.findUnique({
        where: { id: transaction.application.ownerId },
        select: {
          id: true,
          username: true,
          nickname: true,
          status: true,
          points: true,
        },
      }),
    ])

    if (!payer || payer.status !== "ACTIVE") {
      apiError(403, "当前账号状态不可支付")
    }

    if (!merchant || merchant.status !== "ACTIVE") {
      apiError(400, "商户账号当前不可收款")
    }

    const eventData = buildPaymentPointEventData(transaction)
    const debit = await applyPointDelta({
      tx,
      userId: payer.id,
      beforeBalance: payer.points,
      prepared: pointDelta("PAYMENT_APP_OUTGOING", -transaction.amount),
      reason: `支付给 ${transaction.application.name}：${transaction.description}`,
      pointName: settings.pointName,
      eventType: POINT_LOG_EVENT_TYPES.PAYMENT_APP_PAID,
      eventData: {
        ...eventData,
        payerUserId: payer.id,
      },
      insufficientMessage: `${settings.pointName}不足，无法完成支付`,
    })

    await applyPointDelta({
      tx,
      userId: merchant.id,
      beforeBalance: payer.id === merchant.id ? debit.afterBalance : merchant.points,
      prepared: pointDelta("PAYMENT_APP_INCOMING", transaction.merchantPoints),
      reason: `收到 ${getUserDisplayName(payer)} 的支付：${transaction.description}`,
      pointName: settings.pointName,
      eventType: POINT_LOG_EVENT_TYPES.PAYMENT_APP_RECEIVED,
      eventData: {
        ...eventData,
        payerUserId: payer.id,
      },
    })

    return tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentTransactionStatus.COMPLETED,
        payerId: payer.id,
        paidAt: new Date(),
        errorMessage: null,
      },
      select: {
        applicationId: true,
        transactionId: true,
        orderId: true,
        amount: true,
        platformFee: true,
        merchantPoints: true,
        description: true,
        paidAt: true,
        application: {
          select: {
            id: true,
            paymentId: true,
            ownerId: true,
            callbackUrl: true,
            secretHash: true,
          },
        },
      },
    })
  })

  const paidAt = completed.paidAt ?? new Date()
  await executeAddonActionHook("payment.transaction.completed", {
    transactionId: completed.transactionId,
    applicationId: completed.application.id,
    paymentId: completed.application.paymentId,
    ownerId: completed.application.ownerId,
    payerUserId: input.payerId,
    externalReference: completed.orderId,
    amount: completed.amount,
    platformFee: completed.platformFee,
    description: completed.description,
    paidAt: paidAt.toISOString(),
    occurredAt: new Date().toISOString(),
  })

  return {
    transactionId: completed.transactionId,
    callbackUrl: buildPaymentCallbackUrl({
      transaction: completed,
      callbackUrl: completed.application.callbackUrl,
      secretHash: completed.application.secretHash,
    }),
  }
}

export async function getPaymentCheckoutPageData(transactionId: string): Promise<PaymentCheckoutPageData | null> {
  const transaction = await findPaymentTransactionByTransactionId(normalizeTrimmedText(transactionId, 200))
  if (!transaction) {
    return null
  }

  const callbackUrl = transaction.status === PaymentTransactionStatus.COMPLETED
    ? await buildPaymentTransactionCallbackUrl(transaction.transactionId)
    : null

  return {
    transactionId: transaction.transactionId,
    externalReference: transaction.orderId,
    status: getExternalPaymentStatus(transaction),
    expired: isPaymentTransactionExpired(transaction),
    amount: transaction.amount,
    platformFee: transaction.platformFee,
    description: transaction.description,
    createdAt: transaction.createdAt.toISOString(),
    expiresAt: transaction.expiresAt.toISOString(),
    paidAt: transaction.paidAt?.toISOString() ?? null,
    callbackUrl,
    application: {
      paymentId: transaction.application.paymentId,
      name: transaction.application.name,
      description: transaction.application.description ?? "",
      homepageUrl: transaction.application.homepageUrl ?? "",
      callbackUrl: transaction.application.callbackUrl,
      ownerDisplayName: getUserDisplayName(transaction.application.owner),
    },
    payer: transaction.payer
      ? {
          id: transaction.payer.id,
          displayName: getUserDisplayName(transaction.payer),
          username: transaction.payer.username,
        }
      : null,
  }
}
