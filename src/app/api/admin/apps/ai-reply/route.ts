import { apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField, type JsonObject } from "@/lib/api-route"
import { revalidateSiteSettingsCache } from "@/lib/admin-site-settings-shared"
import { deleteAiReplyTaskLog, deleteAllAiReplyTaskLogs, getAiReplyAdminDataPage } from "@/lib/ai-reply"
import { updateAiReplyConfigFromAdminInput } from "@/lib/ai-reply-config"
import { updateAutoCategorizeConfig } from "@/lib/ai/capabilities/auto-categorize-config"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readPaginationFromRequest(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get("page") ?? "1")
  const autoCategorizePage = Number(searchParams.get("autoPage") ?? "1")
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    autoCategorizePage: Number.isInteger(autoCategorizePage) && autoCategorizePage > 0 ? autoCategorizePage : 1,
  }
}

function readPaginationFromBody(body: JsonObject) {
  const rawPagination = body.pagination
  const pagination = rawPagination && typeof rawPagination === "object" && !Array.isArray(rawPagination)
    ? rawPagination as Record<string, unknown>
    : {}
  const page = Number(pagination.page ?? 1)
  const autoCategorizePage = Number(pagination.autoCategorizePage ?? 1)

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    autoCategorizePage: Number.isInteger(autoCategorizePage) && autoCategorizePage > 0 ? autoCategorizePage : 1,
  }
}

export const GET = createAdminRouteHandler(async ({ request }) => {
  return apiSuccess(await getAiReplyAdminDataPage(readPaginationFromRequest(request)))
}, {
  errorMessage: "AI 后台数据读取失败",
  logPrefix: "[api/admin/apps/ai-reply:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.apps.manage",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const pagination = readPaginationFromBody(body)
  const autoCategorizeInput = isRecord(body.autoCategorizeConfig) ? body.autoCategorizeConfig : null

  await updateAiReplyConfigFromAdminInput(body)
  if (autoCategorizeInput) {
    await updateAutoCategorizeConfig(autoCategorizeInput)
  }
  revalidateSiteSettingsCache()

  return apiSuccess(await getAiReplyAdminDataPage(pagination), "AI 配置已保存")
}, {
  errorMessage: "AI 配置保存失败",
  logPrefix: "[api/admin/apps/ai-reply] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})

export const DELETE = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const pagination = readPaginationFromBody(body)
  const deleteAllLogs = body.deleteAllLogs === true

  if (deleteAllLogs) {
    const deletedCount = await deleteAllAiReplyTaskLogs()
    return apiSuccess(await getAiReplyAdminDataPage(pagination), deletedCount > 0 ? `已删除 ${deletedCount} 条任务日志` : "当前没有可删除的任务日志")
  }

  const taskId = requireStringField(body, "taskId", "缺少任务日志 ID")

  await deleteAiReplyTaskLog(taskId)

  return apiSuccess(await getAiReplyAdminDataPage(pagination), "任务日志已删除")
}, {
  errorMessage: "删除任务日志失败",
  logPrefix: "[api/admin/apps/ai-reply:DELETE] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})
