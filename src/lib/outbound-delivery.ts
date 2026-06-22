import "server-only"

import { registerBackgroundJobHandler } from "@/lib/background-jobs"
import {
  deliverLoginIpChangeAlertEmail,
  deliverPasswordChangeVerificationEmail,
  deliverPaymentGatewayOrderSuccessEmail,
  deliverRegisterVerificationEmail,
  deliverResetPasswordVerificationEmail,
  deliverSmtpTestEmail,
  deliverUserNotificationEmail,
} from "@/lib/mailer"
import { deliverSms } from "@/lib/sms"

registerBackgroundJobHandler("email.register-verification", async (payload) => {
  await deliverRegisterVerificationEmail(payload)
})

registerBackgroundJobHandler("email.reset-password-verification", async (payload) => {
  await deliverResetPasswordVerificationEmail(payload)
})

registerBackgroundJobHandler("email.password-change-verification", async (payload) => {
  await deliverPasswordChangeVerificationEmail(payload)
})

registerBackgroundJobHandler("email.login-ip-change-alert", async (payload) => {
  await deliverLoginIpChangeAlertEmail(payload)
})

registerBackgroundJobHandler("email.payment-gateway-order-success", async (payload) => {
  await deliverPaymentGatewayOrderSuccessEmail(payload)
})

registerBackgroundJobHandler("email.generic", async (payload) => {
  await deliverUserNotificationEmail(payload)
})

registerBackgroundJobHandler("email.smtp-test", async (payload) => {
  await deliverSmtpTestEmail(payload)
})

registerBackgroundJobHandler("sms.send", async (payload) => {
  await deliverSms(payload)
})
