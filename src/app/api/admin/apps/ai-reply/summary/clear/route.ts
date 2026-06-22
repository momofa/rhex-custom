import { z } from "zod"

import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { prisma } from "@/db/client"

const bodySchema = z.object({
  id: z.string().min(1).max(100).optional(),
  all: z.boolean().optional(),
  sourceKind: z.enum(["post", "comment"]).optional(),
  sourceId: z.string().min(1).max(200).optional(),
  olderThanDays: z.number().int().min(0).max(3650).optional(),
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return apiError(400, "请求参数无效")
  }
  const { id, all, sourceKind, sourceId, olderThanDays } = parsed.data

  if (!id && !all && !sourceKind && !sourceId && olderThanDays === undefined) {
    return apiError(400, "至少提供一个清理条件（id / all / sourceKind / sourceId / olderThanDays）")
  }

  const where: Record<string, unknown> = {}
  if (id) where.id = id
  if (sourceKind) where.sourceKind = sourceKind
  if (sourceId) where.sourceId = sourceId
  if (typeof olderThanDays === "number") {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    where.createdAt = { lt: cutoff }
  }

  const result = await prisma.aiSummaryCache.deleteMany({ where })
  return apiSuccess({ deleted: result.count })
}, {
  errorMessage: "清理 AI 总结缓存失败",
  logPrefix: "[api/admin/apps/ai-reply/summary/clear:POST] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.apps.manage",
})
