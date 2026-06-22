"use client"

import { CheckCircle2, Clock3, Sparkles, WalletCards } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { showConfirm } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { VipBadge } from "@/components/vip/vip-badge"
import { formatCompactPointValue, formatDateTime } from "@/lib/formatters"
import { isVipActive } from "@/lib/vip-status"
import { cn } from "@/lib/utils"

interface VipActionPanelProps {
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
  pointName: string
  userPoints?: number
  vipExpiresAt?: string | null
}

type VipPurchaseAction = "purchase.month" | "purchase.quarter" | "purchase.year"

interface VipActionResult {
  message?: string
  data?: {
    expiresAt?: string | null
    mode?: "activate" | "renew"
  }
}

interface VipPlan {
  action: VipPurchaseAction
  level: number
  name: string
  duration: string
  price: number
  highlight?: boolean
}

function createVipRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return `vip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function VipActionPanel({
  vipMonthlyPrice,
  vipQuarterlyPrice,
  vipYearlyPrice,
  pointName,
  userPoints = 0,
  vipExpiresAt = null,
}: VipActionPanelProps) {
  const vipActive = isVipActive({ vipExpiresAt })
  const router = useRouter()
  const [loading, setLoading] = useState("")

  const plans: VipPlan[] = [
    {
      action: "purchase.month",
      level: 1,
      name: "月度体验",
      duration: "30 天",
      price: vipMonthlyPrice,
    },
    {
      action: "purchase.quarter",
      level: 2,
      name: "季度进阶",
      duration: "90 天",
      price: vipQuarterlyPrice,
      highlight: true,
    },
    {
      action: "purchase.year",
      level: 3,
      name: "年度尊享",
      duration: "365 天",
      price: vipYearlyPrice,
    },
  ]

  async function runAction(plan: VipPlan) {
    const confirmed = await showConfirm({
      title: vipActive ? "确认续费 VIP" : "确认开通 VIP",
      description: `确认${vipActive ? "续费" : "开通"} ${plan.name} VIP${plan.level} 吗？\n生效时长：${plan.duration}\n需支付：${formatCompactPointValue(plan.price)} ${pointName}\n${vipActive ? "确认后会在当前到期时间基础上顺延。" : "确认后将立即生效。"}`,
      confirmText: vipActive ? "确认续费" : "确认开通",
    })

    if (!confirmed) {
      return
    }

    setLoading(plan.action)

    try {
      const requestId = createVipRequestId()
      const response = await fetch("/api/vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: plan.action, requestId }),
      })
      const result = await response.json() as VipActionResult
      const nextMessage = result.message ?? (response.ok ? "操作成功" : "操作失败")

      if (!response.ok) {
        toast.error(nextMessage, vipActive ? "续费失败" : "开通失败")
        return
      }

      const successTitle = result.data?.mode === "renew" ? "续费成功" : "开通成功"
      const expiresAt = result.data?.expiresAt
      if (expiresAt) {
        toast.success(`到期时间：${formatDateTime(expiresAt)}`, successTitle)
      } else {
        toast.success(nextMessage, successTitle)
      }

      router.refresh()
    } catch {
      toast.error("操作失败，请稍后重试", vipActive ? "续费失败" : "开通失败")
    } finally {
      setLoading("")
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-3 shadow-[0_18px_58px_-48px_rgba(15,23,42,0.35)] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex h-6 items-center gap-2 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground">
            <WalletCards data-icon="inline-start" />
            {pointName} 支付
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">选择 VIP 方案</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
            当前余额 {formatCompactPointValue(userPoints)} {pointName}
            {vipActive ? "，可在当前到期时间基础上顺延。" : "，开通后立即获得对应权限。"}
          </p>
        </div>
        {vipExpiresAt ? (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">当前到期</p>
            <p className="mt-1">{formatDateTime(vipExpiresAt)}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const affordable = userPoints >= plan.price
          const processing = loading === plan.action

          return (
            <article
              key={plan.action}
              className={cn(
                "relative grid grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-2xl border bg-background p-3 transition-colors lg:block",
                plan.highlight ? "border-foreground/18 bg-muted/30" : "border-border",
              )}
            >
              {plan.highlight ? (
                <div className="absolute right-3 top-3 hidden items-center gap-1 rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-medium text-background lg:inline-flex">
                  <Sparkles data-icon="inline-start" />
                  推荐
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <VipBadge level={plan.level} compact showIcon />
                  <span className="truncate text-sm font-semibold text-foreground">{plan.name}</span>
                </div>
                <p className="mt-2 text-xl font-semibold tracking-tight text-foreground lg:mt-3 lg:text-2xl">
                  {formatCompactPointValue(plan.price)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{pointName}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground lg:mt-1.5">
                  <Clock3 data-icon="inline-start" />
                  生效 {plan.duration}
                </p>
              </div>
              <Button
                type="button"
                className="w-20 rounded-full lg:mt-3 lg:w-full"
                variant={plan.highlight ? "default" : "outline"}
                size="sm"
                onClick={() => runAction(plan)}
                disabled={loading !== "" || !affordable}
              >
                <CheckCircle2 data-icon="inline-start" />
                {processing ? "处理中..." : affordable ? (vipActive ? "续费" : "开通") : `${pointName}不足`}
              </Button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
