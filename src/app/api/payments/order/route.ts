import { apiSuccess, createUserRouteHandler, requireSearchParam } from "@/lib/api-route"
import { getPaymentOrderStatusForUser } from "@/lib/payment-gateway"

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const merchantOrderNo = requireSearchParam(request, "merchantOrderNo", "缺少支付单号")
  const result = await getPaymentOrderStatusForUser(currentUser.id, merchantOrderNo)
  return apiSuccess(result)
}, {
  errorMessage: "支付订单状态读取失败",
  logPrefix: "[api/payments/order] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
