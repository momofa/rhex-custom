import { queryExternalPaymentTransaction } from "@/lib/payment-applications"
import { paymentApiErrorResponse, readPaymentApiBody } from "@/lib/payment-api-routes"

interface PaymentQueryRouteContext {
  params: Promise<{
    paymentId: string
  }>
}

export async function POST(request: Request, context: PaymentQueryRouteContext) {
  try {
    const [{ paymentId }, body] = await Promise.all([
      context.params,
      readPaymentApiBody(request),
    ])
    const result = await queryExternalPaymentTransaction({
      paymentId,
      transactionId: body.transaction_id,
      signature: body.signature,
    })

    return Response.json(result)
  } catch (error) {
    return paymentApiErrorResponse(error)
  }
}
