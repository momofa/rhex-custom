"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { SELF_SERVE_AD_BACKGROUND_COLORS, SELF_SERVE_AD_DURATION_OPTIONS, SELF_SERVE_AD_TEXT_COLORS, toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"


interface SelfServeAdsAdminPageProps {
  AppId: string
  config: Record<string, boolean | number | string>
}

type AdminAdOrderItem = {
  id: string
  userId: number
  slotType: "IMAGE" | "TEXT"
  slotIndex: number
  title: string | null
  linkUrl: string | null
  imageUrl: string | null
  textColor: string | null
  backgroundColor: string | null
  durationMonths: number | null
  pricePoints: number | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "EMPTY"
  reviewNote: string | null
  startsAt: string | null
  endsAt: string | null
  createdAt: string | null
  isPlaceholder: boolean
}

function useConfigState(config: ReturnType<typeof toSelfServeAdConfig>) {
  const [visibleOnHome, setVisibleOnHome] = useState(config.visibleOnHome)
  const [visibleOnPostDetail, setVisibleOnPostDetail] = useState(config.visibleOnPostDetail)
  const [visibleOnGlobalSidebar, setVisibleOnGlobalSidebar] = useState(config.visibleOnGlobalSidebar)
  const [cardTitle, setCardTitle] = useState(config.cardTitle)
  const [sidebarSlot, setSidebarSlot] = useState(config.sidebarSlot)

  const [sidebarOrder, setSidebarOrder] = useState(String(config.sidebarOrder))
  const [imageSlotCount, setImageSlotCount] = useState(String(config.imageSlotCount))
  const [textSlotCount, setTextSlotCount] = useState(String(config.textSlotCount))
  const [imagePriceMonthly, setImagePriceMonthly] = useState(String(config.imagePriceMonthly))
  const [imagePriceQuarterly, setImagePriceQuarterly] = useState(String(config.imagePriceQuarterly))
  const [imagePriceSemiAnnual, setImagePriceSemiAnnual] = useState(String(config.imagePriceSemiAnnual))
  const [imagePriceYearly, setImagePriceYearly] = useState(String(config.imagePriceYearly))
  const [textPriceMonthly, setTextPriceMonthly] = useState(String(config.textPriceMonthly))
  const [textPriceQuarterly, setTextPriceQuarterly] = useState(String(config.textPriceQuarterly))
  const [textPriceSemiAnnual, setTextPriceSemiAnnual] = useState(String(config.textPriceSemiAnnual))
  const [textPriceYearly, setTextPriceYearly] = useState(String(config.textPriceYearly))
  const [placeholderLabel, setPlaceholderLabel] = useState(config.placeholderLabel)

  return {
    visibleOnHome,
    setVisibleOnHome,
    visibleOnPostDetail,
    setVisibleOnPostDetail,
    visibleOnGlobalSidebar,
    setVisibleOnGlobalSidebar,
    cardTitle,
    setCardTitle,
    sidebarSlot,
    setSidebarSlot,

    sidebarOrder,
    setSidebarOrder,
    imageSlotCount,
    setImageSlotCount,
    textSlotCount,
    setTextSlotCount,
    imagePriceMonthly,
    setImagePriceMonthly,
    imagePriceQuarterly,
    setImagePriceQuarterly,
    imagePriceSemiAnnual,
    setImagePriceSemiAnnual,
    imagePriceYearly,
    setImagePriceYearly,
    textPriceMonthly,
    setTextPriceMonthly,
    textPriceQuarterly,
    setTextPriceQuarterly,
    textPriceSemiAnnual,
    setTextPriceSemiAnnual,
    textPriceYearly,
    setTextPriceYearly,
    placeholderLabel,
    setPlaceholderLabel,
  }
}

export function SelfServeAdsAdminPage({ AppId, config }: SelfServeAdsAdminPageProps) {
  const router = useRouter()
  const normalizedConfig = toSelfServeAdConfig(config)
  const state = useConfigState(normalizedConfig)
  const [orders, setOrders] = useState<AdminAdOrderItem[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    void loadAdminData()
  }, [AppId])

  async function loadAdminData() {
    setLoadingData(true)
    try {
      const response = await fetch(`/api/admin/apps/self-serve-ads`, {
        method: "GET",
        cache: "no-store",
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "广告后台数据加载失败", "加载失败")
        return
      }
      setOrders(result.data?.items ?? [])
    } catch {
      toast.error("广告后台数据加载失败，请稍后重试", "加载失败")
    } finally {
      setLoadingData(false)
    }
  }

  async function saveConfig() {
    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/apps/self-serve-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-config",
          config: {
            enabled: true,
            visibleOnHome: state.visibleOnHome,
            visibleOnPostDetail: state.visibleOnPostDetail,
            visibleOnGlobalSidebar: state.visibleOnGlobalSidebar,
            cardTitle: state.cardTitle,
            sidebarSlot: state.sidebarSlot,

            sidebarOrder: Number(state.sidebarOrder || 0),
            imageSlotCount: Number(state.imageSlotCount || 0),
            textSlotCount: Number(state.textSlotCount || 0),
            imagePriceMonthly: Number(state.imagePriceMonthly || 0),
            imagePriceQuarterly: Number(state.imagePriceQuarterly || 0),
            imagePriceSemiAnnual: Number(state.imagePriceSemiAnnual || 0),
            imagePriceYearly: Number(state.imagePriceYearly || 0),
            textPriceMonthly: Number(state.textPriceMonthly || 0),
            textPriceQuarterly: Number(state.textPriceQuarterly || 0),
            textPriceSemiAnnual: Number(state.textPriceSemiAnnual || 0),
            textPriceYearly: Number(state.textPriceYearly || 0),
            placeholderLabel: state.placeholderLabel,
          },
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        setFeedback(result.message ?? "配置保存失败")
        return
      }

      setFeedback(result.message ?? "配置已保存")
      await loadAdminData()
      router.refresh()
    })
  }

  async function submitOrderAction(action: "approve" | "reject" | "expire" | "update", order: AdminAdOrderItem) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/apps/self-serve-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.id,
          action,
          slotIndex: order.slotIndex,
          title: order.title ?? "",
          linkUrl: order.linkUrl ?? "",
          imageUrl: order.imageUrl ?? "",
          textColor: order.textColor ?? "#0f172a",
          backgroundColor: order.backgroundColor ?? "#f8fafc",
          durationMonths: order.durationMonths ?? 1,
          reviewNote: order.reviewNote ?? "",
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "订单处理失败", "操作失败")
        return
      }

      toast.success(result.message ?? "订单已更新", "操作成功")
      setOrders((current) => current.map((item) => item.id === order.id ? {
        ...item,
        status: action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : action === "expire" ? "EXPIRED" : item.status === "APPROVED" ? "PENDING" : item.status,
        reviewNote: order.reviewNote,
        title: order.title,
        linkUrl: order.linkUrl,
        imageUrl: order.imageUrl,
        textColor: order.textColor,
        backgroundColor: order.backgroundColor,
        durationMonths: order.durationMonths,
        slotIndex: order.slotIndex,
      } : item))

      await loadAdminData()
      setEditingId(null)
      router.refresh()
    })
  }

  function updateOrder(id: string, patch: Partial<AdminAdOrderItem>) {
    setOrders((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">自助推广广告位应用后台</h3>
            <p className="mt-1 text-sm text-muted-foreground">配置首页右侧布局与价格，并审核用户提交的广告订单。</p>
          </div>
          <Button type="button" variant="outline" onClick={loadAdminData} disabled={loadingData || isPending}>{loadingData ? "加载中..." : "刷新订单"}</Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h4 className="text-sm font-semibold">布局与定价</h4>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[16px] border border-border bg-background px-4 py-3 text-sm">
            <span className="font-medium">首页显示广告卡片</span>
            <input type="checkbox" checked={state.visibleOnHome} onChange={(event) => state.setVisibleOnHome(event.target.checked)} className="h-4 w-4 rounded border-border" />
          </label>
          <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[16px] border border-border bg-background px-4 py-3 text-sm">
            <span className="font-medium">帖子详情页显示</span>
            <input type="checkbox" checked={state.visibleOnPostDetail} onChange={(event) => state.setVisibleOnPostDetail(event.target.checked)} className="h-4 w-4 rounded border-border" />
          </label>
          <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[16px] border border-border bg-background px-4 py-3 text-sm">
            <span className="font-medium">其它页面全局右侧显示</span>
            <input type="checkbox" checked={state.visibleOnGlobalSidebar} onChange={(event) => state.setVisibleOnGlobalSidebar(event.target.checked)} className="h-4 w-4 rounded border-border" />
          </label>
          <Field label="卡片标题" value={state.cardTitle} onChange={state.setCardTitle} />

          <Field label="占位按钮文案" value={state.placeholderLabel} onChange={state.setPlaceholderLabel} />
          <Field label="侧栏插槽">
            <select value={state.sidebarSlot} onChange={(event) => state.setSidebarSlot(event.target.value as "home-right-top" | "home-right-middle" | "home-right-bottom")} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden">
              <option value="home-right-top">home-right-top</option>
              <option value="home-right-middle">home-right-middle</option>
              <option value="home-right-bottom">home-right-bottom</option>
            </select>
          </Field>
          <Field label="侧栏排序值" value={state.sidebarOrder} onChange={state.setSidebarOrder} />
          <Field label="图片广告位数量" value={state.imageSlotCount} onChange={state.setImageSlotCount} />
          <Field label="文字广告位数量" value={state.textSlotCount} onChange={state.setTextSlotCount} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <PriceBlock title="图片广告价格" pointName="积分">
            <Field label="1个月" value={state.imagePriceMonthly} onChange={state.setImagePriceMonthly} />
            <Field label="3个月" value={state.imagePriceQuarterly} onChange={state.setImagePriceQuarterly} />
            <Field label="6个月" value={state.imagePriceSemiAnnual} onChange={state.setImagePriceSemiAnnual} />
            <Field label="12个月" value={state.imagePriceYearly} onChange={state.setImagePriceYearly} />
          </PriceBlock>
          <PriceBlock title="文字广告价格" pointName="积分">
            <Field label="1个月" value={state.textPriceMonthly} onChange={state.setTextPriceMonthly} />
            <Field label="3个月" value={state.textPriceQuarterly} onChange={state.setTextPriceQuarterly} />
            <Field label="6个月" value={state.textPriceSemiAnnual} onChange={state.setTextPriceSemiAnnual} />
            <Field label="12个月" value={state.textPriceYearly} onChange={state.setTextPriceYearly} />
          </PriceBlock>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" disabled={isPending} onClick={saveConfig}>{isPending ? "保存中..." : "保存配置"}</Button>
          {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">广告订单审核</h4>
            <p className="mt-1 text-sm text-muted-foreground">图片广告一行一个，文字广告紧凑展示并支持在线调整配色。</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">共 {orders.length} 条</span>
        </div>

        {orders.length === 0 ? <p className="text-sm text-muted-foreground">暂无广告订单，页面已自动拉取最新数据；后续新订单会显示在这里。</p> : null}

        <div className="space-y-3">
          {orders.map((order) => {
            const expanded = editingId === order.id
            return (
              <article key={order.id} className="rounded-[18px] border border-border bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">{order.slotType === "IMAGE" ? `图片位 #${order.slotIndex + 1}` : `文字位 #${order.slotIndex + 1}`}</span>
                      <StatusBadge status={order.status} />
                      <span className="text-xs text-muted-foreground">用户 #{order.userId}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">{order.slotType === "IMAGE" ? order.imageUrl ?? "未填写图片地址" : order.title ?? "未填写标题"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{order.linkUrl ?? "-"} · {order.durationMonths ?? 0} 个月 · {order.pricePoints ?? 0} 积分</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order.startsAt ? `开始 ${order.startsAt}` : "尚未开始"} · {order.endsAt ? `到期 ${order.endsAt}` : "暂无到期时间"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setEditingId(expanded ? null : order.id)}>{expanded ? "收起" : "编辑"}</Button>
                    {order.status !== "APPROVED" && order.status !== "EXPIRED" ? <Button type="button" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitOrderAction("approve", order)}>通过</Button> : null}
                    {order.status !== "REJECTED" && order.status !== "EXPIRED" ? <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitOrderAction("reject", order)}>驳回</Button> : null}
                    {order.status === "APPROVED" ? <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitOrderAction("expire", order)}>过期</Button> : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-4 grid gap-4 rounded-[18px] border border-border bg-card p-4 lg:grid-cols-2">
                    <Field label="槽位序号" value={String(order.slotIndex)} onChange={(value) => updateOrder(order.id, { slotIndex: Number(value || 0) })} />
                    <Field label="购买时长">
                      <select value={String(order.durationMonths ?? 1)} onChange={(event) => updateOrder(order.id, { durationMonths: Number(event.target.value) })} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden">
                        {SELF_SERVE_AD_DURATION_OPTIONS.map((option) => <option key={option.months} value={option.months}>{option.label}</option>)}
                      </select>
                    </Field>
                    <Field label="广告链接" value={order.linkUrl ?? ""} onChange={(value) => updateOrder(order.id, { linkUrl: value })} className="lg:col-span-2" />
                    {order.slotType === "IMAGE" ? (
                      <Field label="广告图片地址" value={order.imageUrl ?? ""} onChange={(value) => updateOrder(order.id, { imageUrl: value })} className="lg:col-span-2" />
                    ) : (
                      <>
                        <Field label="广告标题" value={order.title ?? ""} onChange={(value) => updateOrder(order.id, { title: value })} className="lg:col-span-2" />
                        <ColorPicker label="文字颜色" value={order.textColor ?? "#0f172a"} presets={SELF_SERVE_AD_TEXT_COLORS} onChange={(value) => updateOrder(order.id, { textColor: value })} />
                        <ColorPicker label="背景颜色" value={order.backgroundColor ?? "#f8fafc"} presets={SELF_SERVE_AD_BACKGROUND_COLORS} onChange={(value) => updateOrder(order.id, { backgroundColor: value })} />
                        <div className="lg:col-span-2 rounded-[16px] border border-dashed border-border p-4">
                          <p className="text-xs text-muted-foreground">预览</p>
                          <div className="mt-3 inline-flex rounded-full px-3 py-2 text-sm font-medium" style={{ color: order.textColor ?? "#0f172a", backgroundColor: order.backgroundColor ?? "#f8fafc" }}>
                            {order.title || "文字广告预览"}
                          </div>
                        </div>
                      </>
                    )}
                    <label className="lg:col-span-2 block space-y-2">
                      <span className="text-sm font-medium">审核备注</span>
                      <textarea value={order.reviewNote ?? ""} onChange={(event) => updateOrder(order.id, { reviewNote: event.target.value })} className="min-h-[96px] w-full rounded-[16px] border border-border bg-background px-4 py-3 text-sm outline-hidden" />
                    </label>
                    <div className="lg:col-span-2 flex justify-end">
                      <Button type="button" variant="outline" disabled={isPending} onClick={() => submitOrderAction("update", order)}>保存编辑</Button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function PriceBlock({ title, pointName, children }: { title: string; pointName: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h5 className="text-sm font-semibold">{title}</h5>
        <span className="text-xs text-muted-foreground">单位：{pointName}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, className = "", children }: { label: string; value?: string; onChange?: (value: string) => void; className?: string; children?: React.ReactNode }) {
  return (
    <label className={`block space-y-2 ${className}`.trim()}>
      <span className="text-sm font-medium">{label}</span>
      {children ?? <input value={value} onChange={(event) => onChange?.(event.target.value)} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden" />}
    </label>
  )
}

function ColorPicker({ label, value, presets, onChange }: { label: string; value: string; presets: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 rounded-lg border border-border bg-background p-1" />
        <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-32 rounded-full border border-border bg-background px-3 text-sm outline-hidden" />
        {presets.map((preset) => <button key={`${label}-${preset}`} type="button" className="h-7 w-7 rounded-full border border-border" style={{ backgroundColor: preset }} onClick={() => onChange(preset)} />)}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: AdminAdOrderItem["status"] }) {
  const className = status === "APPROVED"
    ? "bg-emerald-100 text-emerald-700"
    : status === "REJECTED"
      ? "bg-rose-100 text-rose-700"
      : status === "EXPIRED"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-100 text-amber-700"

  const label = status === "APPROVED"
    ? "已通过"
    : status === "REJECTED"
      ? "已驳回"
      : status === "EXPIRED"
        ? "已过期"
        : status === "PENDING"
          ? "待审核"
          : status

  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${className}`}>{label}</span>
}
