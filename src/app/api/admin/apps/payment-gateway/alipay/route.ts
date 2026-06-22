import { revalidatePath } from "next/cache"

import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { revalidateSiteSettingsCache } from "@/lib/admin-site-settings-shared"
import { getPaymentGatewayAdminData } from "@/lib/payment-gateway"
import { updatePaymentGatewayAlipayConfigFromAdminInput } from "@/lib/payment-gateway-config"

export const dynamic = "force-dynamic"

export const GET = createAdminRouteHandler(async () => {
  return apiSuccess(await getPaymentGatewayAdminData())
}, {
  errorMessage: "支付宝后台数据读取失败",
  logPrefix: "[api/admin/apps/payment-gateway/alipay:GET] unexpected error",
  unauthorizedMessage: "无权访问",
  permission: "admin.apps.manage",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  await updatePaymentGatewayAlipayConfigFromAdminInput(body)
  revalidateSiteSettingsCache()
  revalidatePath("/admin/apps/payment-gateway")
  revalidatePath("/admin/apps/payment-gateway/alipay")
  revalidatePath("/admin/apps")

  return apiSuccess(await getPaymentGatewayAdminData(), "支付宝接口配置已保存")
}, {
  errorMessage: "支付宝接口配置保存失败",
  logPrefix: "[api/admin/apps/payment-gateway/alipay:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.apps.manage",
})
