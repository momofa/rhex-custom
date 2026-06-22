import { prisma } from "@/db/client"
import { writeAdminLog } from "@/lib/admin"
import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { invalidateSensitiveWordRulesCache, normalizeSensitiveActionType, normalizeSensitiveMatchType } from "@/lib/content-safety"
import { getRequestIp } from "@/lib/request-ip"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const matchType = normalizeSensitiveMatchType(String(body.matchType ?? "CONTAINS").trim().toUpperCase())
  const actionType = normalizeSensitiveActionType(String(body.actionType ?? "REJECT").trim().toUpperCase())
  const rawWords = Array.isArray(body.words)
    ? body.words
        .filter((item): item is string => typeof item === "string")
        .join("\n")
    : requireStringField(body, "word", "敏感词不能为空")
  const uniqueWords = [...new Set(rawWords
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean))]

  if (uniqueWords.length === 0) {
    apiError(400, "敏感词不能为空")
  }

  const existingWords = await prisma.sensitiveWord.findMany({
    where: {
      word: {
        in: uniqueWords,
      },
    },
    select: {
      word: true,
    },
  })
  const existingWordSet = new Set(existingWords.map((item) => item.word))
  const nextWords = uniqueWords.filter((item) => !existingWordSet.has(item))

  let createdCount = 0
  if (nextWords.length > 0) {
    const created = await prisma.sensitiveWord.createMany({
      data: nextWords.map((word) => ({
        word,
        matchType,
        actionType,
        status: true,
      })),
      skipDuplicates: true,
    })
    createdCount = created.count
  }

  const skippedCount = uniqueWords.length - createdCount
  invalidateSensitiveWordRulesCache()
  await writeAdminLog(adminUser.id, "sensitiveWord.create", "CONFIG", uniqueWords.length === 1 ? uniqueWords[0] : "batch", `创建敏感词规则 ${createdCount} 条`, requestIp)

  if (uniqueWords.length === 1) {
    return apiSuccess(undefined, skippedCount > 0 ? "该敏感词规则已存在，已跳过" : "敏感词规则已创建")
  }

  return apiSuccess(undefined, skippedCount > 0 ? `已新增 ${createdCount} 条规则，跳过 ${skippedCount} 条重复项` : `已新增 ${createdCount} 条规则`)
}, {
  errorMessage: "创建敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:POST] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  permission: "admin.operations.manage",
})

export const PUT = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const id = requireStringField(body, "id", "缺少规则ID")

  await prisma.sensitiveWord.update({
    where: { id },
    data: { status: Boolean(body.status) },
  })
  invalidateSensitiveWordRulesCache()
  await writeAdminLog(adminUser.id, "sensitiveWord.toggle", "CONFIG", id, `切换敏感词规则状态为 ${Boolean(body.status) ? "启用" : "停用"}`, requestIp)

  return apiSuccess(undefined, "规则状态已更新")
}, {
  errorMessage: "更新敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:PUT] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  permission: "admin.operations.manage",
})

export const DELETE = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  if (body.clearAll === true) {
    const result = await prisma.sensitiveWord.deleteMany({})
    invalidateSensitiveWordRulesCache()
    await writeAdminLog(adminUser.id, "sensitiveWord.clear", "CONFIG", "all", `清空敏感词规则 ${result.count} 条`, requestIp)
    return apiSuccess({ deletedCount: result.count }, `已清空 ${result.count} 条规则`)
  }

  if (Array.isArray(body.ids)) {
    const ids = [...new Set(body.ids.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))]

    if (ids.length === 0) {
      apiError(400, "\u8bf7\u9009\u62e9\u8981\u5220\u9664\u7684\u89c4\u5219")
    }

    const result = await prisma.sensitiveWord.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    })
    invalidateSensitiveWordRulesCache()
    await writeAdminLog(adminUser.id, "sensitiveWord.delete", "CONFIG", "batch", `\u5220\u9664\u654f\u611f\u8bcd\u89c4\u5219 ${result.count} \u6761`, requestIp)
    return apiSuccess({ deletedCount: result.count }, `\u5df2\u5220\u9664 ${result.count} \u6761\u89c4\u5219`)
  }
  const id = requireStringField(body, "id", "缺少规则ID")

  await prisma.sensitiveWord.deleteMany({ where: { id: { in: [id] } } })
  invalidateSensitiveWordRulesCache()
  await writeAdminLog(adminUser.id, "sensitiveWord.delete", "CONFIG", id, "删除敏感词规则")
  return apiSuccess(undefined, "规则已删除")
}, {
  errorMessage: "删除敏感词规则失败",
  logPrefix: "[api/admin/sensitive-words:DELETE] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  permission: "admin.operations.manage",
})
