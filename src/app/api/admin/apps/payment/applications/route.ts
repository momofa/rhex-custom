import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import {
  reviewPaymentApplication,
  rotatePaymentApplicationSecretByAdmin,
  updatePaymentApplicationByAdmin,
  type PaymentApplicationListItem,
} from "@/lib/payment-applications"

export const POST = createAdminRouteHandler<PaymentApplicationListItem | { secretKey: string }>(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action : ""
  const id = typeof body.id === "string" ? body.id : ""

  if (!id) {
    apiError(400, "缺少 Payment 应用 ID")
  }

  if (action === "edit") {
    const application = await updatePaymentApplicationByAdmin({
      id,
      name: body.name,
      description: body.description,
      homepageUrl: body.homepageUrl,
      callbackUrl: body.callbackUrl,
    })

    await writeAdminLog(
      adminUser.id,
      "payment-application.edit",
      "PAYMENT_APPLICATION",
      id,
      `编辑 Payment 应用 ${application.paymentId}`,
      getRequestIp(request),
    )

    return apiSuccess(application, "Payment 应用已更新")
  }

  if (action === "approve" || action === "reject" || action === "disable") {
    const application = await reviewPaymentApplication({
      id,
      reviewerId: adminUser.id,
      action,
      reviewNote: body.reviewNote,
    })

    await writeAdminLog(
      adminUser.id,
      `payment-application.${action}`,
      "PAYMENT_APPLICATION",
      id,
      `${action} Payment application ${application.paymentId}`,
      getRequestIp(request),
    )

    return apiSuccess(application, "Payment 应用已处理")
  }

  if (action === "rotate-secret") {
    const result = await rotatePaymentApplicationSecretByAdmin({ id })

    await writeAdminLog(
      adminUser.id,
      "payment-application.rotate-secret",
      "PAYMENT_APPLICATION",
      id,
      "重置 Payment 应用 Secret Key",
      getRequestIp(request),
    )

    return apiSuccess(result, "Payment 应用 Secret Key 已重置")
  }

  apiError(400, "不支持的 Payment 应用操作")
}, {
  errorMessage: "处理 Payment 应用失败",
  logPrefix: "[api/admin/apps/payment/applications] unexpected error",
  unauthorizedMessage: "无权管理 Payment 应用",
  allowModerator: false,
  permission: "admin.operations.manage",
})
