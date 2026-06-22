"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"

import { ColorPicker as UIColorPicker } from "@/components/ui/color-picker"
import { Button } from "@/components/ui/rbutton"
import { showConfirm } from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"

import { SELF_SERVE_AD_BACKGROUND_COLORS, SELF_SERVE_AD_DURATION_OPTIONS, SELF_SERVE_AD_TEXT_COLORS, validateSelfServeAdPurchaseDraft, type SelfServeAdPurchaseDraft, type SelfServeAdSlotType } from "@/lib/self-serve-ads.shared"

interface SelfServeAdsPurchasePageProps {
  slotType: SelfServeAdSlotType
  slotIndex: number
  pointName: string
  prices: {
    IMAGE: Record<1 | 3 | 6 | 12, number>
    TEXT: Record<1 | 3 | 6 | 12, number>
  }
}

const INITIAL_FORM: SelfServeAdPurchaseDraft = {
  slotType: "TEXT",
  slotIndex: 0,
  title: "",
  linkUrl: "",
  imageUrl: "",
  textColor: "#0f172a",
  backgroundColor: "#f8fafc",
  durationMonths: 1,
}

export function SelfServeAdsPurchasePage({ slotType, slotIndex, pointName, prices }: SelfServeAdsPurchasePageProps) {
  const [form, setForm] = useState<SelfServeAdPurchaseDraft>({ ...INITIAL_FORM, slotType, slotIndex })
  const [successMessage, setSuccessMessage] = useState("")
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const currentPrice = useMemo(() => prices[slotType][form.durationMonths], [form.durationMonths, prices, slotType])
  const validation = useMemo(() => validateSelfServeAdPurchaseDraft({ ...form, slotType, slotIndex }), [form, slotIndex, slotType])
  const isSubmitDisabled = isPending || !validation.success
  const titleLength = form.title.trim().length
  const linkLength = form.linkUrl.trim().length
  const imageUrlLength = form.imageUrl.trim().length

  function updateForm<K extends keyof SelfServeAdPurchaseDraft>(key: K, value: SelfServeAdPurchaseDraft[K]) {
    setForm((current) => ({ ...current, slotType, slotIndex, [key]: value }))
  }

  async function submitPurchase() {
    setSubmitAttempted(true)
    if (!validation.success) {
      toast.error(validation.firstError ?? "请先修正表单错误", "表单校验未通过")
      return
    }

    const confirmationMessage = `确认购买第 ${slotIndex + 1} 个${slotType === "IMAGE" ? "图片" : "文字"}广告位吗？\n购买时长：${validation.normalized.durationMonths} 个月\n需支付：${currentPrice} ${pointName}\n提交后将进入后台审核。`
    const confirmed = await showConfirm({
      title: "确认购买广告位",
      description: confirmationMessage,
      confirmText: "确认购买",
    })
    if (!confirmed) {
      return
    }

    setSuccessMessage("")
    startTransition(async () => {
      const response = await fetch(`/api/self-serve-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.normalized),
      })

      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "广告申请提交失败", "提交失败")
        return
      }
      const message = result.message ?? "广告申请已提交，待管理员审核"
      setSuccessMessage(`${message} 已扣除 ${currentPrice} ${pointName}。`)
      setForm({ ...INITIAL_FORM, slotType, slotIndex })
      setSubmitAttempted(false)
      toast.success(message, "提交成功")
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-xs shadow-black/5 dark:shadow-black/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">购买{slotType === "IMAGE" ? "图片" : "文字"}广告位</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">当前购买的是第 {slotIndex + 1} 个{slotType === "IMAGE" ? "图片" : "文字"}广告位，提交后进入后台审核。</p>
          </div>
          <Link href="/" className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">返回首页</Link>
        </div>
      </section>

      {successMessage ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {successMessage}
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <Field label="广告链接" hint="必须以 http:// 或 https:// 开头，最多 500 个字符。" error={submitAttempted ? validation.errors.linkUrl : undefined} meta={`${linkLength}/500`}>
          <input value={form.linkUrl} maxLength={500} onChange={(event) => updateForm("linkUrl", event.target.value)} className={getInputClassName(Boolean(submitAttempted && validation.errors.linkUrl))} placeholder="https://example.com" aria-invalid={Boolean(submitAttempted && validation.errors.linkUrl)} />
        </Field>

        {slotType === "IMAGE" ? (
          <Field label="广告图片 URL" hint="请提供可直接访问的图片地址，建议尺寸 320×60，最多 500 个字符。" error={submitAttempted ? validation.errors.imageUrl : undefined} meta={`${imageUrlLength}/500`}>
            <input value={form.imageUrl} maxLength={500} onChange={(event) => updateForm("imageUrl", event.target.value)} className={getInputClassName(Boolean(submitAttempted && validation.errors.imageUrl))} placeholder="https://example.com/banner.jpg" aria-invalid={Boolean(submitAttempted && validation.errors.imageUrl)} />
          </Field>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
            <Field label="广告标题" hint="必填，最多 12 个字符。" className="lg:col-span-3" error={submitAttempted ? validation.errors.title : undefined} meta={`${titleLength}/12`}>
              <input value={form.title} maxLength={12} onChange={(event) => updateForm("title", event.target.value)} className={getInputClassName(Boolean(submitAttempted && validation.errors.title))} placeholder="请输入文字广告标题" aria-invalid={Boolean(submitAttempted && validation.errors.title)} />
            </Field>
            <ColorPicker label="文字颜色" value={form.textColor} presets={SELF_SERVE_AD_TEXT_COLORS} onChange={(value) => updateForm("textColor", value)} />
            <ColorPicker label="文字背景" value={form.backgroundColor} presets={SELF_SERVE_AD_BACKGROUND_COLORS} onChange={(value) => updateForm("backgroundColor", value)} />
            <div className="rounded-[16px] border border-dashed border-border px-3 py-2.5 lg:min-w-[220px]">
              <p className="text-[11px] text-muted-foreground">预览</p>
              <div className="mt-2 inline-flex min-w-[160px] break-all rounded-[12px] px-3 py-2 text-xs font-medium" style={{ color: validation.normalized.textColor, backgroundColor: validation.normalized.backgroundColor }}>{validation.normalized.title || "文字广告预览"}</div>
            </div>
          </div>
        )}

        <Field label="购买时长" hint={`当前价格：${currentPrice} ${pointName}`} useLabel={false}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {SELF_SERVE_AD_DURATION_OPTIONS.map((option) => {
              const active = option.months === form.durationMonths
              return (
                <button key={option.months} type="button" onClick={() => updateForm("durationMonths", option.months)} className={active ? "rounded-[14px] border border-foreground bg-foreground px-2.5 py-2.5 text-xs font-medium text-background shadow-xs" : "rounded-[14px] border border-border bg-background px-2.5 py-2.5 text-xs text-muted-foreground transition hover:border-foreground/20 hover:bg-accent hover:text-foreground"}>
                  <div>{option.label}</div>
                  <div className="mt-1 text-[11px]">{prices[slotType][option.months]} {pointName}</div>
                </button>
              )
            })}
          </div>
        </Field>

        <div className="rounded-[16px] border border-dashed border-border bg-accent/40 px-4 py-3 text-xs leading-6 text-muted-foreground">
          <p>提交前请确认广告内容、链接地址与购买时长无误。</p>
          <p>链接必须是有效的 HTTP/HTTPS 地址，文字广告标题超出 12 个字会提示优化，图片地址与广告链接均限制在 500 个字符内。</p>
          <p>点击“提交购买申请”后，会先进行二次确认；确认提交后将立即扣除 {currentPrice} {pointName}，并进入后台审核。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="h-8 rounded-lg px-3 text-xs" disabled={isSubmitDisabled} onClick={submitPurchase}>{isPending ? "提交中..." : "提交购买申请"}</Button>
          <Link href="/" className="inline-flex h-8 items-center rounded-lg px-3 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground">取消</Link>
        </div>
      </section>
    </div>
  )
}

function Field({ label, hint, error, meta, children, className = "", useLabel = true }: { label: string; hint: string; error?: string; meta?: string; children: React.ReactNode; className?: string; useLabel?: boolean }) {
  const Container = useLabel ? "label" : "div"

  return (
    <Container className={`block space-y-1.5 text-sm ${className}`.trim()}>
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{label}</span>
        {meta ? <span className="text-[11px] text-muted-foreground">{meta}</span> : null}
      </span>
      <p className="text-[11px] leading-5 text-muted-foreground">{hint}</p>
      {children}
      {error ? <p className="text-[11px] leading-5 text-destructive">{error}</p> : null}
    </Container>
  )
}

function getInputClassName(hasError: boolean) {
  return `h-10 w-full rounded-[16px] border bg-background px-3 text-sm outline-hidden transition ${hasError ? "border-destructive focus-visible:ring-1 focus-visible:ring-destructive/40" : "border-border focus-visible:ring-1 focus-visible:ring-ring/40"}`
}

function ColorPicker({ label, value, presets, onChange }: { label: string; value: string; presets: readonly string[]; onChange: (value: string) => void }) {
  return (
    <UIColorPicker
      label={label}
      value={value}
      onChange={onChange}
      presets={presets}
      fallbackColor={presets[0] ?? "#0f172a"}
      popoverTitle={`选择${label}`}
      containerClassName="space-y-1.5"
    />
  )
}

