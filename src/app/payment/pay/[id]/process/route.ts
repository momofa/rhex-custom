import { createExternalPaymentTransaction } from "@/lib/payment-applications"
import { paymentApiErrorResponse, readPaymentApiBody } from "@/lib/payment-api-routes"

interface PaymentProcessRouteContext {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: PaymentProcessRouteContext) {
  try {
    const [{ id }, body] = await Promise.all([
      context.params,
      readPaymentApiBody(request),
    ])
    const result = await createExternalPaymentTransaction({
      paymentId: id,
      amount: body.amount,
      description: body.description,
      orderId: body.order_id,
      signature: body.signature,
      baseUrl: new URL(request.url).origin,
    })

    return Response.json(result)
  } catch (error) {
    return paymentApiErrorResponse(error)
  }
}
