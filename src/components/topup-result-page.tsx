"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/rbutton"
import { formatCompactPointValue, formatDateTime } from "@/lib/formatters"

interface TopupResultPageProps {
  merchantOrderNo: string
  pointName: string
  initialStatus: {
    merchantOrderNo: string
    status: string
    fulfillmentStatus: string
    fulfilledAt: string | null
    paidAt: string | null
    amountFen: number
    currency: string
    lastErrorCode: string | null
    lastErrorMessage: string | null
    userBalance?: number | null
    topup: {
      title: string
      points: number
      bonusPoints: number
      totalPoints: number
    } | null
  }
}

function formatAmountFen(amountFen: number, currency: string) {
  return `${currency} ${(amountFen / 100).toFixed(2)}`
}

export function TopupResultPage({ merchantOrderNo, pointName, initialStatus }: TopupResultPageProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)

  useEffect(() => {
    if (
      !["PENDING", "WAIT_BUYER_PAY", "PAID"].includes(status.status)
      || (status.status === "PAID" && ["SUCCEEDED", "FAILED"].includes(status.fulfillmentStatus))
    ) {
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const response = await fetch(`/api/payments/order?merchantOrderNo=${encodeURIComponent(merchantOrderNo)}`, {
          method: "GET",
          cache: "no-store",
        })
        const result = await response.json()
        if (!response.ok || !result?.data) {
          throw new Error(result?.message ?? "充值订单状态获取失败")
        }

        if (cancelled) {
          return
        }

        const nextStatus = result.data as typeof initialStatus
        setStatus(nextStatus)

        if (
          ["FAILED", "CLOSED", "REFUNDED"].includes(nextStatus.status)
          || (nextStatus.status === "PAID" && ["SUCCEEDED", "FAILED"].includes(nextStatus.fulfillmentStatus))
        ) {
          return
        }

        timer = setTimeout(() => {
          void poll()
        }, 3000)
      } catch {
        timer = setTimeout(() => {
          void poll()
        }, 4000)
      }
    }

    timer = setTimeout(() => {
      void poll()
    }, 2500)

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [initialStatus, merchantOrderNo, status.fulfillmentStatus, status.status])

  const succeeded = status.status === "PAID" && status.fulfillmentStatus === "SUCCEEDED"
  const failed = ["FAILED", "CLOSED", "REFUNDED"].includes(status.status) || status.fulfillmentStatus === "FAILED"
  const waitingPayment = ["PENDING", "WAIT_BUYER_PAY"].includes(status.status)
  const title = succeeded
    ? "充值成功"
    : failed
      ? "充值未完成"
      : waitingPayment
        ? "等待支付完成"
        : "支付成功，正在到账"

  const description = succeeded
    ? `本次充值已完成，${formatCompactPointValue(status.topup?.totalPoints ?? 0)} ${pointName} 已到账。`
    : failed
      ? (status.lastErrorMessage || "订单未完成，请返回充值页重新发起。")
      : waitingPayment
        ? "如果你刚刚完成支付，请稍等几秒，系统会自动刷新订单状态。"
        : "支付已经确认，系统正在处理积分到账，请不要重复付款。"

  useEffect(() => {
    if (!succeeded) {
      return
    }

    router.refresh()
  }, [router, status.fulfilledAt, succeeded])

  return (
    <div className="space-y-6">
      <section className={`rounded-xl border p-6 ${succeeded ? "border-emerald-200 bg-emerald-50/70" : failed ? "border-rose-200 bg-rose-50/70" : "border-border bg-card"}`}>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs text-muted-foreground">支付单号</p>
            <p className="mt-2 break-all text-sm font-semibold">{status.merchantOrderNo}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs text-muted-foreground">支付金额</p>
            <p className="mt-2 text-sm font-semibold">{formatAmountFen(status.amountFen, status.currency)}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs text-muted-foreground">支付状态</p>
            <p className="mt-2 text-sm font-semibold">{status.status}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs text-muted-foreground">履约状态</p>
            <p className="mt-2 text-sm font-semibold">{status.fulfillmentStatus}</p>
          </div>
        </div>

        {status.topup ? (
          <div className="mt-4 rounded-xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm font-semibold">{status.topup.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              基础 {formatCompactPointValue(status.topup.points)} {pointName}
              {status.topup.bonusPoints > 0 ? ` + 赠送 ${formatCompactPointValue(status.topup.bonusPoints)} ${pointName}` : ""}
            </p>
            <p className="mt-1 text-lg font-semibold">共到账 {formatCompactPointValue(status.topup.totalPoints)} {pointName}</p>
            {typeof status.userBalance === "number" ? (
              <p className="mt-1 text-sm text-muted-foreground">当前余额 {formatCompactPointValue(status.userBalance)} {pointName}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {status.paidAt ? <span>支付时间：{formatDateTime(status.paidAt)}</span> : null}
          {status.fulfilledAt ? <span>到账时间：{formatDateTime(status.fulfilledAt)}</span> : null}
          {status.lastErrorCode ? <span>错误码：{status.lastErrorCode}</span> : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/topup">
          <Button type="button">继续充值</Button>
        </Link>
        <Link href="/settings?tab=points">
          <Button type="button" variant="outline">查看积分明细</Button>
        </Link>
      </div>
    </div>
  )
}
