import { prisma } from "@/db/client"
import { PostAuctionStatus, type Prisma } from "@/db/types"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import {
  isBackgroundJobNonProductionNodeEnv,
  readBackgroundJobWebRuntimeMode,
} from "@/lib/background-job-config"
import {
  normalizeRequestedWorkerLogPage,
  readFiniteNumber,
  serializeOptionalDateTime,
  stringifyJsonPreview,
  summarizeBackgroundJobPayload,
  summarizeExecutionLog,
} from "@/lib/background-job-admin/format-helpers"
import { readDeadLetterSnapshot, type RedisQueueSnapshot } from "@/lib/background-job-admin/queue-snapshot"
import { type BackgroundJobConnectionKind } from "@/lib/background-job-admin/redis-parsers"
import {
  resolveBackgroundJobConcurrency,
  resolveBackgroundJobMaxAttempts,
  resolveBackgroundJobRetryDelayMs,
} from "@/lib/background-jobs"
import { getBackgroundJobExecutionLogPage } from "@/lib/background-job-log-store"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { hasRedisUrl } from "@/lib/redis"

export interface BackgroundWorkerAdminData {
  runtime: {
    transport: "redis" | "in-memory"
    transportLabel: string
    redisEnabled: boolean
    webRuntimeMode: string
    webConsumesJobs: boolean
    concurrency: number
    maxAttempts: number
    retryBaseDelayMs: number
  }
  queue: {
    streamLength: number | null
    pendingCount: number | null
    delayedCount: number | null
    deadLetterCount: number
    liveWorkerCount: number | null
    auxiliaryConnectionCount: number | null
    adminConnectionCount: number | null
    liveWorkers: RedisQueueSnapshot["liveWorkers"]
    delayedJobs: {
      items: Array<{
        id: string
        jobName: string
        attempt: number
        maxAttempts: number
        enqueuedAt: string
        availableAt: string | null
        delayRemainingMs: number | null
        payloadSummary: string
        payloadPreview: string
      }>
      pagination: RedisQueueSnapshot["delayedPagination"]
    }
  }
  executionLogs: {
    items: Array<{
      id: string
      occurredAt: string
      level: "info" | "error"
      action: string
      jobName: string | null
      attempt: number | null
      maxAttempts: number | null
      summary: string
      payloadSummary: string | null
      metadataPreview: string | null
      errorName: string | null
      errorMessage: string | null
    }>
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
      hasPrevPage: boolean
      hasNextPage: boolean
    }
  }
  deadLetters: {
    items: Array<{
      id: string
      failedAt: string
      retryable: boolean
      jobName: string
      attempt: number
      maxAttempts: number
      errorName: string
      errorMessage: string
      auction: {
        id: string
        postId: string
        postSlug: string
        postTitle: string
        status: string
      } | null
    }>
    pagination: RedisQueueSnapshot["deadLetterPagination"]
  }
  auctionSettlement: {
    settlingCount: number
    pendingEntryCount: number
    items: Array<{
      auctionId: string
      postId: string
      postSlug: string
      postTitle: string
      sellerName: string
      participantCount: number
      processedCount: number
      remainingCount: number
      progressPercent: number
      endsAt: string
      updatedAt: string
      winnerReady: boolean
      finalPriceReady: boolean
    }>
  }
}

// Ensure BackgroundJobConnectionKind import is preserved for downstream tooling.
export type { BackgroundJobConnectionKind }

function resolveBackgroundJobWebRuntimeMode() {
  return readBackgroundJobWebRuntimeMode() || "auto"
}

function resolveBackgroundJobWebConsumesJobs() {
  const mode = resolveBackgroundJobWebRuntimeMode()

  if (mode === "1" || mode === "true" || mode === "on" || mode === "enabled" || mode === "hybrid") {
    return true
  }

  if (mode === "0" || mode === "false" || mode === "off" || mode === "disabled" || mode === "worker-only") {
    return false
  }

  return isBackgroundJobNonProductionNodeEnv()
}

function getUserDisplayName(user: { username: string; nickname?: string | null }) {
  return user.nickname?.trim() || user.username
}

function buildAuctionPendingSettlementWhere(
  auctionId: string,
  winnerUserId: number,
  finalPrice: number,
): Prisma.PostAuctionEntryWhereInput {
  return {
    auctionId,
    OR: [
      {
        userId: {
          not: winnerUserId,
        },
        frozenAmount: {
          gt: 0,
        },
      },
      {
        userId: winnerUserId,
        frozenAmount: {
          gt: finalPrice,
        },
      },
    ],
  }
}

export async function getBackgroundWorkerAdminData(options?: {
  logPage?: number
  delayedPage?: number
  deadLetterPage?: number
}): Promise<BackgroundWorkerAdminData> {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.apps.manage",
    "无权限访问 Worker 中心",
  )

  const requestedLogPage = normalizeRequestedWorkerLogPage(options?.logPage)
  const requestedDelayedPage = normalizeRequestedWorkerLogPage(options?.delayedPage)
  const requestedDeadLetterPage = normalizeRequestedWorkerLogPage(options?.deadLetterPage)

  const [queueSnapshot, executionLogPage, settlingAuctions] = await Promise.all([
    readDeadLetterSnapshot({
      delayedPage: requestedDelayedPage,
      delayedPageSize: 10,
      deadLetterPage: requestedDeadLetterPage,
      deadLetterPageSize: 10,
    }),
    getBackgroundJobExecutionLogPage({
      page: requestedLogPage,
      pageSize: 10,
    }),
    prisma.postAuction.findMany({
      where: {
        status: PostAuctionStatus.SETTLING,
      },
      select: {
        id: true,
        postId: true,
        participantCount: true,
        endsAt: true,
        updatedAt: true,
        winnerUserId: true,
        finalPrice: true,
        post: {
          select: {
            slug: true,
            title: true,
          },
        },
        seller: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: 20,
    }),
  ])

  const settlementItems = await Promise.all(settlingAuctions.map(async (auction) => {
    const remainingCount = auction.winnerUserId !== null && auction.finalPrice !== null
      ? await prisma.postAuctionEntry.count({
        where: buildAuctionPendingSettlementWhere(
          auction.id,
          auction.winnerUserId,
          auction.finalPrice,
        ),
      })
      : await prisma.postAuctionEntry.count({
        where: {
          auctionId: auction.id,
        },
      })

    const processedCount = Math.max(0, auction.participantCount - remainingCount)
    const progressPercent = auction.participantCount > 0
      ? Math.min(100, Math.round((processedCount / auction.participantCount) * 100))
      : 100

    return {
      auctionId: auction.id,
      postId: auction.postId,
      postSlug: auction.post.slug,
      postTitle: auction.post.title,
      sellerName: getUserDisplayName(auction.seller),
      participantCount: auction.participantCount,
      processedCount,
      remainingCount,
      progressPercent,
      endsAt: serializeOptionalDateTime(auction.endsAt) ?? auction.endsAt.toISOString(),
      updatedAt: serializeOptionalDateTime(auction.updatedAt) ?? auction.updatedAt.toISOString(),
      winnerReady: auction.winnerUserId !== null,
      finalPriceReady: auction.finalPrice !== null,
    }
  }))

  const deadLetterAuctionIds = Array.from(new Set(queueSnapshot.deadLetters
    .map((item) => {
      const payload = item.job.payload
      return payload && typeof payload === "object" && "auctionId" in payload && typeof payload.auctionId === "string"
        ? payload.auctionId
        : null
    })
    .filter((item): item is string => Boolean(item))))

  const deadLetterAuctions = deadLetterAuctionIds.length > 0
    ? await prisma.postAuction.findMany({
      where: {
        id: {
          in: deadLetterAuctionIds,
        },
      },
      select: {
        id: true,
        status: true,
        postId: true,
        post: {
          select: {
            slug: true,
            title: true,
          },
        },
      },
    })
    : []

  const deadLetterAuctionMap = new Map(deadLetterAuctions.map((item) => [item.id, item]))
  const pendingEntryCount = settlementItems.reduce((total, item) => total + item.remainingCount, 0)
  const nowMs = Date.now()
  const delayedJobs = queueSnapshot.delayedJobs.map((item) => {
    const availableAt = item.job.availableAt ?? new Date(item.scoreMs).toISOString()

    return {
      id: item.job.id,
      jobName: item.job.name,
      attempt: item.job.attempt,
      maxAttempts: item.job.maxAttempts,
      enqueuedAt: serializeOptionalDateTime(item.job.enqueuedAt) ?? item.job.enqueuedAt,
      availableAt: serializeOptionalDateTime(availableAt) ?? availableAt,
      delayRemainingMs: Math.max(0, item.scoreMs - nowMs),
      payloadSummary: summarizeBackgroundJobPayload(item.job.payload),
      payloadPreview: stringifyJsonPreview(item.job.payload),
    }
  })
  const serializedExecutionLogs = executionLogPage.items.map((item) => {
    const metadata = item.metadata ?? null
    const extra = item.extra ?? null
    const payload = metadata?.payload
    const mergedPreviewSource = {
      ...(metadata ?? {}),
      ...(extra ?? {}),
    }

    return {
      id: item.id,
      occurredAt: serializeOptionalDateTime(item.occurredAt) ?? item.occurredAt,
      level: item.level,
      action: item.action ?? "event",
      jobName: typeof metadata?.jobName === "string" ? metadata.jobName : null,
      attempt: readFiniteNumber(metadata?.attempt),
      maxAttempts: readFiniteNumber(metadata?.maxAttempts),
      summary: summarizeExecutionLog(item),
      payloadSummary: typeof payload === "undefined" ? null : summarizeBackgroundJobPayload(payload),
      metadataPreview: Object.keys(mergedPreviewSource).length > 0 ? stringifyJsonPreview(mergedPreviewSource) : null,
      errorName: item.error?.name ?? null,
      errorMessage: item.error?.message ?? null,
    }
  })

  return {
    runtime: {
      transport: hasRedisUrl() ? "redis" : "in-memory",
      transportLabel: hasRedisUrl() ? "Redis 持久化队列" : "进程内内存队列",
      redisEnabled: hasRedisUrl(),
      webRuntimeMode: resolveBackgroundJobWebRuntimeMode(),
      webConsumesJobs: resolveBackgroundJobWebConsumesJobs(),
      concurrency: resolveBackgroundJobConcurrency(),
      maxAttempts: resolveBackgroundJobMaxAttempts(),
      retryBaseDelayMs: resolveBackgroundJobRetryDelayMs(1),
    },
    queue: {
      streamLength: queueSnapshot.streamLength,
      pendingCount: queueSnapshot.pendingCount,
      delayedCount: queueSnapshot.delayedCount,
      deadLetterCount: queueSnapshot.deadLetterCount,
      liveWorkerCount: hasRedisUrl()
        ? queueSnapshot.liveWorkers.filter((item) => item.connectionKind === "lane").length
        : null,
      auxiliaryConnectionCount: hasRedisUrl()
        ? queueSnapshot.liveWorkers.filter((item) => item.connectionKind === "transport" || item.connectionKind === "other").length
        : null,
      adminConnectionCount: hasRedisUrl()
        ? queueSnapshot.liveWorkers.filter((item) => item.connectionKind === "admin").length
        : null,
      liveWorkers: queueSnapshot.liveWorkers,
      delayedJobs: {
        items: delayedJobs,
        pagination: queueSnapshot.delayedPagination,
      },
    },
    executionLogs: {
      items: serializedExecutionLogs,
      pagination: {
        page: executionLogPage.page,
        pageSize: executionLogPage.pageSize,
        total: executionLogPage.total,
        totalPages: executionLogPage.totalPages,
        hasPrevPage: executionLogPage.hasPrevPage,
        hasNextPage: executionLogPage.hasNextPage,
      },
    },
    deadLetters: {
      items: queueSnapshot.deadLetters.map((item) => {
        const payload = item.job.payload
        const auctionId = payload && typeof payload === "object" && "auctionId" in payload && typeof payload.auctionId === "string"
          ? payload.auctionId
          : null
        const auction = auctionId ? deadLetterAuctionMap.get(auctionId) ?? null : null

        return {
          id: item.job.id,
          failedAt: item.failedAt,
          retryable: item.retryable,
          jobName: item.job.name,
          attempt: item.job.attempt,
          maxAttempts: item.job.maxAttempts,
          errorName: item.error.name,
          errorMessage: item.error.message,
          auction: auction
            ? {
              id: auction.id,
              postId: auction.postId,
              postSlug: auction.post.slug,
              postTitle: auction.post.title,
              status: auction.status,
            }
            : null,
        }
      }),
      pagination: queueSnapshot.deadLetterPagination,
    },
    auctionSettlement: {
      settlingCount: settlementItems.length,
      pendingEntryCount,
      items: settlementItems,
    },
  }
}
