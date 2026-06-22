import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { canSendBusinessEmail, deliverPaymentGatewayOrderSuccessEmail } from "@/lib/mailer"
import { getServerPaymentGatewayConfig } from "@/lib/payment-gateway-config"

const PAYMENT_GATEWAY_ORDER_SUCCESS_EMAIL_JOB_NAME = "payment-gateway.order-success-email"

export interface PaymentGatewayOrderSuccessEmailSnapshot {
  merchantOrderNo: string
  bizScene: string
  orderSubject: string
  amountFen: number
  currency: string
  providerCode: string
  channelCode: string
  paidAt: string
  username: string
  pointName?: string | null
  points?: number | null
  bonusPoints?: number | null
  totalPoints?: number | null
}

function hasPaymentGatewayOrderSuccessEmailTarget(config: Awaited<ReturnType<typeof getServerPaymentGatewayConfig>>) {
  return Boolean(config.paymentSuccessEmailNotificationEnabled && config.paymentSuccessEmailRecipient)
}

export async function maybeEnqueuePaymentGatewayOrderSuccessEmail(snapshot: PaymentGatewayOrderSuccessEmailSnapshot) {
  const [config, smtpReady] = await Promise.all([
    getServerPaymentGatewayConfig(),
    canSendBusinessEmail("paymentOrderSuccess"),
  ])

  if (!hasPaymentGatewayOrderSuccessEmailTarget(config) || !smtpReady) {
    return
  }

  await enqueueBackgroundJob(PAYMENT_GATEWAY_ORDER_SUCCESS_EMAIL_JOB_NAME, snapshot)
}

registerBackgroundJobHandler(PAYMENT_GATEWAY_ORDER_SUCCESS_EMAIL_JOB_NAME, async (payload) => {
  const [config, smtpReady] = await Promise.all([
    getServerPaymentGatewayConfig(),
    canSendBusinessEmail("paymentOrderSuccess"),
  ])

  if (!hasPaymentGatewayOrderSuccessEmailTarget(config) || !smtpReady) {
    return
  }

  await deliverPaymentGatewayOrderSuccessEmail({
    to: config.paymentSuccessEmailRecipient,
    ...payload,
  })
})
