import { PaymentApiError } from "@/lib/payment-applications"
import { isPublicRouteError } from "@/lib/public-route-error"

export async function readPaymentApiBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null)
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    return Object.fromEntries(formData.entries())
  }

  const text = await request.text().catch(() => "")
  if (!text.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return Object.fromEntries(new URLSearchParams(text).entries())
  }
}

export function paymentApiErrorResponse(error: unknown) {
  if (error instanceof PaymentApiError) {
    return Response.json({ success: false, error: error.message }, { status: error.status })
  }

  if (isPublicRouteError(error)) {
    return Response.json({ success: false, error: error.message }, { status: error.statusCode })
  }

  console.error("[payment-api] unexpected error", error)
  return Response.json({ success: false, error: "Payment request failed" }, { status: 500 })
}
