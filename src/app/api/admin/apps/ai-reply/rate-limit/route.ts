import { z } from "zod"

import { AI_REPLY_APP_KEY, getRateLimitConfig, updateRateLimitConfig } from "@/lib/ai/capabilities/rate-limit-config"
import { getTodayUsage, resetTodayUsage } from "@/lib/ai/rate-limit"
import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"

const updateSchema = z.object({
  dailyMax: z.coerce.number().int().min(0).max(1_000_000),
})

const resetSchema = z.object({
  appKey: z.string().min(1).max(200),
})

export const GET = createAdminRouteHandler(async () => {
  const [config, usage] = await Promise.all([
    getRateLimitConfig(),
    getTodayUsage([AI_REPLY_APP_KEY]),
  ])
  return apiSuccess({
    config,
    usage,
    appKeys: [AI_REPLY_APP_KEY],
  })
}, {
  errorMessage: "读取日调用上限配置失败",
  logPrefix: "[api/admin/apps/ai-reply/rate-limit:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.apps.manage",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0]?.message ?? "参数错误")
  }
  const next = await updateRateLimitConfig({ dailyMax: parsed.data.dailyMax })
  return apiSuccess({ config: next }, "日调用上限已更新")
}, {
  errorMessage: "保存日调用上限配置失败",
  logPrefix: "[api/admin/apps/ai-reply/rate-limit:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})

export const DELETE = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0]?.message ?? "参数错误")
  }
  const res = await resetTodayUsage(parsed.data.appKey)
  return apiSuccess(res, "今日计数已重置")
}, {
  errorMessage: "重置今日计数失败",
  logPrefix: "[api/admin/apps/ai-reply/rate-limit:DELETE] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})
