import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { revalidateSiteSettingsCache } from "@/lib/admin-site-settings-shared"
import { clearPaymentGatewayAdminLogs, getPaymentGatewayAdminData } from "@/lib/payment-gateway"
import { updatePaymentGatewayBaseConfigFromAdminInput } from "@/lib/payment-gateway-config"

export const dynamic = "force-dynamic"

function readPaginationFromRequest(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get("page") ?? "1")
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function readPaginationFromBody(body: Record<string, unknown>) {
  const rawPagination = body.pagination
  const pagination = rawPagination && typeof rawPagination === "object" && !Array.isArray(rawPagination)
    ? rawPagination as Record<string, unknown>
    : {}
  const page = Number(pagination.page ?? 1)

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export const GET = createAdminRouteHandler(async ({ request }) => {
  return apiSuccess(await getPaymentGatewayAdminData(readPaginationFromRequest(request)))
}, {
  errorMessage: "支付网关后台数据读取失败",
  logPrefix: "[api/admin/apps/payment-gateway:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.apps.manage",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const pagination = readPaginationFromBody(body)
  await updatePaymentGatewayBaseConfigFromAdminInput(body)
  revalidateSiteSettingsCache()
  revalidatePath("/admin/apps/payment-gateway")
  revalidatePath("/admin/apps")

  return apiSuccess(await getPaymentGatewayAdminData(pagination), "支付网关配置已保存")
}, {
  errorMessage: "支付网关配置保存失败",
  logPrefix: "[api/admin/apps/payment-gateway:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})

export const DELETE = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const pagination = readPaginationFromBody(body)
  const deletedCount = await clearPaymentGatewayAdminLogs()
  revalidatePath("/admin/apps/payment-gateway")

  return apiSuccess(
    await getPaymentGatewayAdminData(pagination),
    deletedCount > 0 ? `已清除 ${deletedCount} 条已结束支付日志` : "当前没有可清除的支付日志",
  )
}, {
  errorMessage: "清除支付日志失败",
  logPrefix: "[api/admin/apps/payment-gateway:DELETE] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})
