import { z } from "zod"

import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { prisma } from "@/db/client"

const PAGE_SIZE = 20

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  sourceKind: z.enum(["post", "comment"]).optional(),
  sourceId: z.string().min(1).max(200).optional(),
  modelKey: z.string().min(1).max(200).optional(),
})

export const GET = createAdminRouteHandler(async ({ request }) => {
  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    sourceKind: url.searchParams.get("sourceKind") ?? undefined,
    sourceId: url.searchParams.get("sourceId") ?? undefined,
    modelKey: url.searchParams.get("modelKey") ?? undefined,
  })
  if (!parsed.success) {
    return apiError(400, "请求参数无效")
  }
  const { page, sourceKind, sourceId, modelKey } = parsed.data

  const where: Record<string, unknown> = {}
  if (sourceKind) where.sourceKind = sourceKind
  if (sourceId) where.sourceId = sourceId
  if (modelKey) where.modelKey = modelKey

  const [total, items, stats] = await Promise.all([
    prisma.aiSummaryCache.count({ where }),
    prisma.aiSummaryCache.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        sourceKind: true,
        sourceId: true,
        modelKey: true,
        contentHash: true,
        summary: true,
        hitCount: true,
        createdAt: true,
        lastHitAt: true,
      },
    }),
    prisma.aiSummaryCache.aggregate({
      _count: { _all: true },
      _sum: { hitCount: true },
    }),
  ])

  return apiSuccess({
    items,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
    stats: {
      totalEntries: stats._count._all,
      totalHits: stats._sum.hitCount ?? 0,
    },
  })
}, {
  errorMessage: "读取 AI 总结缓存失败",
  logPrefix: "[api/admin/apps/ai-reply/summary/list:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.apps.manage",
})
