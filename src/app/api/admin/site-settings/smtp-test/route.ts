import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, readOptionalNumberField, readOptionalStringField } from "@/lib/api-route"
import { sendSmtpTestEmail } from "@/lib/mailer"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const recipient = readOptionalStringField(body, "recipient")
  const siteName = readOptionalStringField(body, "siteName") || "站点"
  const smtpHost = readOptionalStringField(body, "smtpHost")
  const smtpPort = readOptionalNumberField(body, "smtpPort")
  const smtpUser = readOptionalStringField(body, "smtpUser")
  const smtpPass = readOptionalStringField(body, "smtpPass")
  const smtpFrom = readOptionalStringField(body, "smtpFrom")
  const smtpSecure = body.smtpSecure === true

  if (!recipient) {
    apiError(400, "请填写测试收件邮箱")
  }

  if (!isValidEmail(recipient)) {
    apiError(400, "测试收件邮箱格式不正确")
  }

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    apiError(400, "请先完整填写 SMTP 主机、端口、账号、密码和发件人地址")
  }

  await sendSmtpTestEmail({
    to: recipient,
    siteName,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpSecure,
  })

  return apiSuccess(undefined, `测试邮件已加入发送队列：${recipient}`)
}, {
  errorMessage: "发送测试邮件失败",
  logPrefix: "[api/admin/site-settings/smtp-test:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
