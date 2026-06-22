import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { parseBusinessDateTime } from "@/lib/formatters"
import { createRedeemCodes, deleteRedeemCodes, getRedeemCodeList } from "@/lib/redeem-codes"

type DeleteScope = "single" | "used" | "unused" | "all"

function readDeleteScope(value: unknown): DeleteScope {
  if (value === "single" || value === "used" || value === "unused" || value === "all") {
    return value
  }

  apiError(400, "删除范围不正确")
}

export const GET = createAdminRouteHandler(async () => {
  const redeemCodes = await getRedeemCodeList()
  return apiSuccess(redeemCodes)
}, {
  errorMessage: "读取兑换码失败",
  logPrefix: "[api/admin/redeem-codes:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.operations.manage",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const count = Math.max(1, Math.min(100, Number(body.count ?? 1) || 1))
  const points = Math.max(1, Number(body.points ?? 0) || 0)
  const note = typeof body.note === "string" ? body.note.trim() : ""
  const codeCategory = typeof body.codeCategory === "string" ? body.codeCategory.trim() : ""
  const categoryUserLimitInput = body.categoryUserLimit
  const categoryUserLimit = categoryUserLimitInput === null || categoryUserLimitInput === undefined || categoryUserLimitInput === ""
    ? null
    : Math.trunc(Number(categoryUserLimitInput))
  const expiresAtInput = typeof body.expiresAt === "string" ? body.expiresAt.trim() : ""
  const expiresAt = expiresAtInput ? parseBusinessDateTime(expiresAtInput) : null

  if (categoryUserLimit !== null && (!Number.isFinite(categoryUserLimit) || categoryUserLimit < 1)) {
    apiError(400, "分类使用上限必须为正整数，或留空表示不限制")
  }

  if (Number.isNaN(expiresAt?.getTime())) {

    apiError(400, "过期时间格式不正确")
  }

  const rows = await createRedeemCodes({
    count,
    points,
    codeCategory,
    categoryUserLimit,
    createdById: adminUser.id,
    note,
    expiresAt,
  })


  return apiSuccess(rows, `已生成 ${rows.length} 个兑换码`)
}, {
  errorMessage: "兑换码生成失败",
  logPrefix: "[api/admin/redeem-codes:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})

export const DELETE = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const scope = readDeleteScope(body.scope)
  const id = typeof body.id === "string" ? body.id : undefined
  const deletedCount = await deleteRedeemCodes({ scope, id })

  return apiSuccess({ deletedCount }, `已删除 ${deletedCount} 个兑换码`)
}, {
  errorMessage: "删除兑换码失败",
  logPrefix: "[api/admin/redeem-codes:DELETE] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
