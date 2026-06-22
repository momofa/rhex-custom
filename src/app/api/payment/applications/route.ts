import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import {
  createOwnPaymentApplication,
  rotateOwnPaymentApplicationSecret,
  updateOwnPaymentApplication,
} from "@/lib/payment-applications"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action : ""

  if (action === "create") {
    const result = await createOwnPaymentApplication({
      ownerId: currentUser.id,
      name: body.name,
      description: body.description,
      homepageUrl: body.homepageUrl,
      callbackUrl: body.callbackUrl,
    })

    return apiSuccess(result, "Payment 应用已创建")
  }

  if (action === "update") {
    await updateOwnPaymentApplication({
      ownerId: currentUser.id,
      id: typeof body.id === "string" ? body.id : "",
      name: body.name,
      description: body.description,
      homepageUrl: body.homepageUrl,
      callbackUrl: body.callbackUrl,
    })

    return apiSuccess(undefined, "Payment 应用已更新")
  }

  if (action === "rotate-secret") {
    const result = await rotateOwnPaymentApplicationSecret({
      ownerId: currentUser.id,
      id: typeof body.id === "string" ? body.id : "",
    })

    return apiSuccess(result, "Payment 应用 Secret Key 已重置")
  }

  apiError(400, "不支持的 Payment 应用操作")
}, {
  errorMessage: "处理 Payment 应用失败",
  logPrefix: "[api/payment/applications] unexpected error",
  unauthorizedMessage: "请先登录后再管理 Payment 应用",
  allowStatuses: ["ACTIVE"],
})
