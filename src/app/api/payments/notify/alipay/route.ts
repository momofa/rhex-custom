import { handleAlipayPaymentNotification } from "@/lib/payment-gateway"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const payload = Object.fromEntries(new URLSearchParams(body).entries())
    const success = await handleAlipayPaymentNotification(payload)
    return new Response(success ? "success" : "failure", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("[api/payments/notify/alipay] unexpected error", error)
    return new Response("failure", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    })
  }
}
