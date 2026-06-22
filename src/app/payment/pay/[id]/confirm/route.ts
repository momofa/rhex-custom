import { getSessionActorFromRequest } from "@/lib/auth"
import { buildLoginHrefWithRedirect } from "@/lib/auth-redirect"
import { confirmPaymentTransaction, PaymentApiError } from "@/lib/payment-applications"
import { isPublicRouteError } from "@/lib/public-route-error"

interface PaymentConfirmRouteContext {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: PaymentConfirmRouteContext) {
  const { id } = await context.params
  const transactionId = id
  const paymentPath = `/payment/pay/${encodeURIComponent(transactionId)}`
  const currentUser = await getSessionActorFromRequest(request)

  if (!currentUser) {
    return Response.redirect(new URL(buildLoginHrefWithRedirect(paymentPath), request.url), 303)
  }

  if (currentUser.status !== "ACTIVE") {
    return redirectToPaymentWithError(request.url, paymentPath, "当前账号状态不可支付")
  }

  try {
    const result = await confirmPaymentTransaction({
      transactionId,
      payerId: currentUser.id,
    })

    return Response.redirect(result.callbackUrl ?? new URL(paymentPath, request.url), 303)
  } catch (error) {
    if (error instanceof PaymentApiError) {
      return redirectToPaymentWithError(request.url, paymentPath, error.message)
    }

    if (isPublicRouteError(error)) {
      return redirectToPaymentWithError(request.url, paymentPath, error.message)
    }

    console.error("[payment/pay/[transactionId]/confirm] unexpected error", error)
    return redirectToPaymentWithError(request.url, paymentPath, "支付失败，请稍后重试")
  }
}

function redirectToPaymentWithError(requestUrl: string, paymentPath: string, message: string) {
  const url = new URL(paymentPath, requestUrl)
  url.searchParams.set("error", message)
  return Response.redirect(url, 303)
}
