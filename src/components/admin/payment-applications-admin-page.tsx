"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Copy, CreditCard, Pencil, ReceiptText, RotateCcw, ShieldOff, XCircle } from "lucide-react"

import { AdminPaginationBar } from "@/components/admin/admin-pagination-bar"
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FormModal, Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { formatCompactPointValue, formatDateTime, formatNumber } from "@/lib/formatters"
import type { PaymentApplicationAdminPageData, PaymentApplicationListItem, PaymentTransactionListItem, PaymentTransactionPageData } from "@/lib/payment-applications"

interface PaymentApplicationsAdminPageProps {
  initialData: PaymentApplicationAdminPageData
  basePath?: string
  settingsHref?: string
}

interface PaymentApplicationEditFormState {
  name: string
  description: string
  homepageUrl: string
  callbackUrl: string
}

type ReviewAction = "approve" | "reject" | "disable"

const statusOptions = [
  { value: "ALL", label: "全部状态" },
  { value: "PENDING", label: "待审核" },
  { value: "ACTIVE", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "DISABLED", label: "已禁用" },
]

const pageSizeOptions = [20, 50, 100]
const orderPageSizeOptions = [10, 20, 50, 100]
const transactionStatusOptions = [
  { value: "ALL", label: "全部状态" },
  { value: "PENDING", label: "待支付" },
  { value: "PROCESSING", label: "处理中" },
  { value: "COMPLETED", label: "已完成" },
  { value: "FAILED", label: "失败" },
  { value: "CANCELLED", label: "已取消" },
  { value: "REFUNDED", label: "已退款" },
]

function getInitialEditForm(application: PaymentApplicationListItem): PaymentApplicationEditFormState {
  return {
    name: application.name,
    description: application.description,
    homepageUrl: application.homepageUrl,
    callbackUrl: application.callbackUrl,
  }
}

export function PaymentApplicationsAdminPage({
  initialData,
  basePath = "/admin/settings/oauth/payment",
  settingsHref = "/admin/settings/oauth/settings",
}: PaymentApplicationsAdminPageProps) {
  const router = useRouter()
  const [reviewTarget, setReviewTarget] = useState<PaymentApplicationListItem | null>(null)
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [editTarget, setEditTarget] = useState<PaymentApplicationListItem | null>(null)
  const [editForm, setEditForm] = useState<PaymentApplicationEditFormState | null>(null)
  const [secretModal, setSecretModal] = useState<{ paymentId: string; secretKey: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const baseQuery = useMemo(() => new URLSearchParams({
    keyword: initialData.filters.keyword,
    status: initialData.filters.status,
    pageSize: String(initialData.pagination.pageSize),
  }), [initialData.filters.keyword, initialData.filters.status, initialData.pagination.pageSize])
  const orderBaseQuery = useMemo(() => {
    const query = new URLSearchParams({
      orderKeyword: initialData.transactions.filters.keyword,
      orderStatus: initialData.transactions.filters.status,
      orderPageSize: String(initialData.transactions.pagination.pageSize),
    })

    if (initialData.filters.keyword) {
      query.set("keyword", initialData.filters.keyword)
    }

    if (initialData.filters.status !== "ALL") {
      query.set("status", initialData.filters.status)
    }

    if (initialData.pagination.page > 1) {
      query.set("page", String(initialData.pagination.page))
    }

    query.set("pageSize", String(initialData.pagination.pageSize))

    return query
  }, [
    initialData.filters.keyword,
    initialData.filters.status,
    initialData.pagination.page,
    initialData.pagination.pageSize,
    initialData.transactions.filters.keyword,
    initialData.transactions.filters.status,
    initialData.transactions.pagination.pageSize,
  ])

  function buildPageHref(page: number) {
    const query = new URLSearchParams(baseQuery)
    query.set("page", String(page))
    return `${basePath}?${query.toString()}`
  }

  function buildOrderPageHref(page: number) {
    const query = new URLSearchParams(orderBaseQuery)
    query.set("orderPage", String(page))
    return `${basePath}?${query.toString()}`
  }

  function openReviewModal(application: PaymentApplicationListItem, action: ReviewAction) {
    setReviewTarget(application)
    setReviewAction(action)
    setReviewNote(application.reviewNote ?? "")
  }

  function closeReviewModal() {
    if (isPending) {
      return
    }

    setReviewTarget(null)
    setReviewAction(null)
    setReviewNote("")
  }

  function openEditModal(application: PaymentApplicationListItem) {
    setEditTarget(application)
    setEditForm(getInitialEditForm(application))
  }

  function closeEditModal() {
    if (isPending) {
      return
    }

    setEditTarget(null)
    setEditForm(null)
  }

  function updateEditForm<Key extends keyof PaymentApplicationEditFormState>(field: Key, value: PaymentApplicationEditFormState[Key]) {
    setEditForm((current) => current ? { ...current, [field]: value } : current)
  }

  function submitEdit() {
    if (!editTarget || !editForm) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/payment/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            id: editTarget.id,
            name: editForm.name,
            description: editForm.description,
            homepageUrl: editForm.homepageUrl,
            callbackUrl: editForm.callbackUrl,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "更新 Payment 应用失败")
        }

        toast.success(result.message ?? "Payment 应用已更新", "Payment 应用")
        router.refresh()
        closeEditModal()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "更新 Payment 应用失败", "Payment 应用")
      }
    })
  }

  function submitReview() {
    if (!reviewTarget || !reviewAction) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/payment/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: reviewAction,
            id: reviewTarget.id,
            reviewNote,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "处理 Payment 应用失败")
        }

        toast.success(result.message ?? "操作成功", "Payment 应用")
        router.refresh()
        closeReviewModal()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "处理 Payment 应用失败", "Payment 应用")
      }
    })
  }

  function resetSecret(application: PaymentApplicationListItem) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/payment/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rotate-secret",
            id: application.id,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "重置 Secret Key 失败")
        }

        setSecretModal({
          paymentId: application.paymentId,
          secretKey: String(result.data?.secretKey ?? ""),
        })
        toast.success("Secret Key 已重置", "Payment 应用")
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "重置 Secret Key 失败", "Payment 应用")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="border-b">
          <div>
            <CardTitle>Payment 应用审核</CardTitle>
            <CardDescription>审核用户申请的 Payment 应用，控制 Payment ID / Secret Key 生命周期，以及启用或禁用第三方支付接入。</CardDescription>
          </div>
          <CardAction>
            <Link href={settingsHref}>
              <Button type="button" variant="outline">服务设置</Button>
            </Link>
          </CardAction>
        </CardHeader>
      </Card>

      <AdminSummaryStrip
        items={[
          { label: "应用总数", value: initialData.summary.total, icon: <CreditCard /> },
          { label: "待审核", value: initialData.summary.pending, icon: <CreditCard />, tone: "amber" },
          { label: "已通过", value: initialData.summary.active, icon: <CheckCircle2 />, tone: "emerald" },
          { label: "已驳回", value: initialData.summary.rejected, icon: <XCircle />, tone: "rose" },
          { label: "已禁用", value: initialData.summary.disabled, icon: <ShieldOff /> },
        ]}
      />

      <form className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[minmax(180px,1fr)_160px_120px_auto]">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">搜索应用</span>
          <input name="keyword" defaultValue={initialData.filters.keyword} placeholder="应用名 / Payment ID / 申请人" className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" />
        </label>
        <CompactSelect name="status" label="状态" value={initialData.filters.status} options={statusOptions} />
        <CompactSelect name="pageSize" label="每页" value={String(initialData.pagination.pageSize)} options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))} />
        <div className="flex items-end gap-2">
          <input type="hidden" name="page" value="1" />
          <Button type="submit">筛选</Button>
          <Link href={basePath}>
            <Button type="button" variant="outline">重置</Button>
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Payment 应用列表</CardTitle>
          <CardDescription>通过后应用即可调用 `/payment/pay/:payment_id/process` 和 `/payment/query/:payment_id`。</CardDescription>
          <CardAction>
            <Badge variant="secondary" className="rounded-full">当前 {initialData.applications.length} 条</Badge>
          </CardAction>
        </CardHeader>
        {initialData.applications.length > 0 ? (
          <AdminPaginationBar pagination={initialData.pagination} buildPageHref={buildPageHref} itemLabel="个应用" className="border-b border-border px-4 py-3" />
        ) : null}
        <CardContent className="px-0 py-0">
          {initialData.applications.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有 Payment 应用。</div>
          ) : (
            <div className="divide-y divide-border">
              {initialData.applications.map((application) => (
                <article key={application.id} className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.4fr)_240px_260px_260px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{application.name}</h3>
                      <PaymentApplicationStatusBadge status={application.status} />
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">Payment ID: <code>{application.paymentId}</code></p>
                    {application.description ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{application.description}</p> : null}
                    {application.reviewNote ? <p className="mt-2 text-xs text-amber-700">审核备注：{application.reviewNote}</p> : null}
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <p>申请人：{application.owner?.displayName ?? "未知"} @{application.owner?.username ?? "-"}</p>
                    <p>账号状态：{application.owner?.status ?? "-"}</p>
                    <p>创建：{formatDateTime(application.createdAt)}</p>
                    <p>更新：{formatDateTime(application.updatedAt)}</p>
                    <p>审核：{application.reviewedAt ? formatDateTime(application.reviewedAt) : "待处理"}</p>
                  </div>
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                    <p>网站地址：</p>
                    <code className="break-all">{application.homepageUrl || "未填写"}</code>
                    <p>支付回调：</p>
                    <code className="break-all">{application.callbackUrl}</code>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => openEditModal(application)}>
                      <Pencil data-icon="inline-start" />
                      编辑
                    </Button>
                    {application.status === "PENDING" ? (
                      <>
                        <Button type="button" disabled={isPending} onClick={() => openReviewModal(application, "approve")}>通过</Button>
                        <Button type="button" variant="outline" disabled={isPending} onClick={() => openReviewModal(application, "reject")}>驳回</Button>
                      </>
                    ) : null}
                    {application.status === "ACTIVE" ? (
                      <Button type="button" variant="outline" disabled={isPending} onClick={() => openReviewModal(application, "disable")}>禁用</Button>
                    ) : null}
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => resetSecret(application)}>
                      <RotateCcw data-icon="inline-start" />
                      重置 Secret
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
        <AdminPaginationBar pagination={initialData.pagination} buildPageHref={buildPageHref} itemLabel="个应用" className="border-t border-border px-4 py-3" />
      </Card>

      <PaymentTransactionsAdminCard
        data={initialData.transactions}
        basePath={basePath}
        buildPageHref={buildOrderPageHref}
      />

      <ReviewModal
        target={reviewTarget}
        action={reviewAction}
        note={reviewNote}
        isPending={isPending}
        onNoteChange={setReviewNote}
        onClose={closeReviewModal}
        onSubmit={submitReview}
      />
      <EditPaymentApplicationModal
        target={editTarget}
        form={editForm}
        isPending={isPending}
        onChange={updateEditForm}
        onClose={closeEditModal}
        onSubmit={submitEdit}
      />
      <SecretOnceModal secret={secretModal} onClose={() => setSecretModal(null)} />
    </div>
  )
}

function PaymentTransactionsAdminCard({
  data,
  basePath,
  buildPageHref,
}: {
  data: PaymentTransactionPageData
  basePath: string
  buildPageHref: (page: number) => string
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>Payment 所有订单</CardTitle>
          <CardDescription>查看所有开发者 Payment 应用产生的交易订单，用于对账、风控和回调排查。</CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary" className="rounded-full">共 {formatNumber(data.summary.total)} 单</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <OrderMetric label="订单总额" value={`${formatCompactPointValue(data.summary.totalAmount)} 积分`} />
          <OrderMetric label="平台手续费" value={`${formatCompactPointValue(data.summary.totalPlatformFee)} 积分`} />
          <OrderMetric label="已完成" value={`${formatNumber(data.summary.completed)} 单`} />
          <OrderMetric label="待处理" value={`${formatNumber(data.summary.pending + data.summary.processing)} 单`} />
        </div>

        <form className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[minmax(180px,1fr)_160px_120px_auto]">
          <input type="hidden" name="orderPage" value="1" />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">搜索订单</span>
            <input name="orderKeyword" defaultValue={data.filters.keyword} placeholder="交易 ID / 业务订单号 / 应用 / 用户" className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" />
          </label>
          <CompactSelect name="orderStatus" label="状态" value={data.filters.status} options={transactionStatusOptions} />
          <CompactSelect name="orderPageSize" label="每页" value={String(data.pagination.pageSize)} options={orderPageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))} />
          <div className="flex items-end gap-2">
            <Button type="submit">筛选</Button>
            <Link href={basePath}>
              <Button type="button" variant="outline">重置</Button>
            </Link>
          </div>
        </form>

        {data.transactions.length > 0 ? (
          <AdminPaginationBar pagination={data.pagination} buildPageHref={buildPageHref} itemLabel="个订单" className="border-b border-border pb-3" />
        ) : null}

        {data.transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有 Payment 订单。</div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {data.transactions.map((transaction) => (
              <AdminPaymentTransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}

        <AdminPaginationBar pagination={data.pagination} buildPageHref={buildPageHref} itemLabel="个订单" className="border-t border-border pt-3" />
      </CardContent>
    </Card>
  )
}

function OrderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function AdminPaymentTransactionRow({ transaction }: { transaction: PaymentTransactionListItem }) {
  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.3fr)_220px_220px_260px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{transaction.description}</h3>
          <PaymentTransactionStatusBadge status={transaction.status} expired={transaction.expired} />
        </div>
        <p className="mt-2 break-all text-xs text-muted-foreground">交易 ID：<code>{transaction.transactionId}</code></p>
        <p className="mt-1 break-all text-xs text-muted-foreground">业务订单号：<code>{transaction.externalReference}</code></p>
        {transaction.errorMessage ? <p className="mt-2 text-xs text-muted-foreground">错误信息：{transaction.errorMessage}</p> : null}
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{formatCompactPointValue(transaction.amount)} 积分</p>
        <p>平台手续费：{formatCompactPointValue(transaction.platformFee)} 积分</p>
        <p>创建：{formatDateTime(transaction.createdAt)}</p>
        <p>过期：{formatDateTime(transaction.expiresAt)}</p>
        {transaction.paidAt ? <p>支付：{formatDateTime(transaction.paidAt)}</p> : null}
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>应用：{transaction.application.name}</p>
        <p className="break-all">Payment ID：<code>{transaction.application.paymentId}</code></p>
        <p>开发者：{transaction.application.owner ? `${transaction.application.owner.displayName} @${transaction.application.owner.username}` : "未知"}</p>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>付款人：{transaction.payer ? `${transaction.payer.displayName} @${transaction.payer.username}` : "未支付"}</p>
        <p>付款账号状态：{transaction.payer?.status ?? "-"}</p>
        <p>外部状态：{transaction.externalStatus}</p>
      </div>
    </article>
  )
}

function CompactSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-hidden">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function EditPaymentApplicationModal({
  target,
  form,
  isPending,
  onChange,
  onClose,
  onSubmit,
}: {
  target: PaymentApplicationListItem | null
  form: PaymentApplicationEditFormState | null
  isPending: boolean
  onChange: <Key extends keyof PaymentApplicationEditFormState>(field: Key, value: PaymentApplicationEditFormState[Key]) => void
  onClose: () => void
  onSubmit: () => void
}) {
  if (!target || !form) {
    return null
  }

  return (
    <FormModal
      open
      title="编辑 Payment 应用"
      description={`修改“${target.name}”的展示资料和支付回调地址。Payment ID / Secret Key 不会变化。`}
      size="lg"
      closeDisabled={isPending}
      closeOnEscape={!isPending}
      formClassName="flex flex-col gap-4"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      footer={({ formId }) => (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>取消</Button>
          <Button type="submit" form={formId} disabled={isPending}>{isPending ? "保存中..." : "保存修改"}</Button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">应用名称 *</span>
          <Input value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="应用名称" required />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">网站地址</span>
          <Input value={form.homepageUrl} onChange={(event) => onChange("homepageUrl", event.target.value)} placeholder="https://example.com" />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">支付回调地址 *</span>
        <Input value={form.callbackUrl} onChange={(event) => onChange("callbackUrl", event.target.value)} placeholder="https://example.com/payment/callback" required />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">应用描述</span>
        <Textarea value={form.description} onChange={(event) => onChange("description", event.target.value)} rows={4} placeholder="说明支付用途。" />
      </label>
    </FormModal>
  )
}

function ReviewModal({
  target,
  action,
  note,
  isPending,
  onNoteChange,
  onClose,
  onSubmit,
}: {
  target: PaymentApplicationListItem | null
  action: ReviewAction | null
  note: string
  isPending: boolean
  onNoteChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  if (!target || !action) {
    return null
  }

  const actionLabel = action === "approve" ? "通过应用" : action === "reject" ? "驳回应用" : "禁用应用"

  return (
    <FormModal
      open
      title={actionLabel}
      description={`处理 Payment 应用“${target.name}”。`}
      closeDisabled={isPending}
      closeOnEscape={!isPending}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      footer={({ formId }) => (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>取消</Button>
          <Button type="submit" form={formId} disabled={isPending}>{isPending ? "处理中..." : actionLabel}</Button>
        </div>
      )}
    >
      <Textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={5} placeholder="审核备注，可选；驳回或禁用时建议填写原因。" />
    </FormModal>
  )
}

function SecretOnceModal({
  secret,
  onClose,
}: {
  secret: { paymentId: string; secretKey: string } | null
  onClose: () => void
}) {
  if (!secret) {
    return null
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} 已复制`, "Payment 应用")
    } catch {
      toast.error("复制失败，请手动复制", "Payment 应用")
    }
  }

  return (
    <Modal
      open
      title="新的 Secret Key"
      description="Secret Key 只会显示这一次，关闭后无法再次查看。"
      onClose={onClose}
      footer={<Button type="button" onClick={onClose}>我已保存</Button>}
    >
      <div className="flex flex-col gap-3">
        <SecretRow label="Payment ID" value={secret.paymentId} onCopy={() => copy(secret.paymentId, "Payment ID")} />
        <SecretRow label="Secret Key" value={secret.secretKey} onCopy={() => copy(secret.secretKey, "Secret Key")} />
      </div>
    </Modal>
  )
}

function SecretRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          <Copy data-icon="inline-start" />
          复制
        </Button>
      </div>
      <code className="block break-all text-sm">{value}</code>
    </div>
  )
}

function PaymentTransactionStatusBadge({
  status,
  expired,
}: {
  status: PaymentTransactionListItem["status"]
  expired?: boolean
}) {
  if (status === "COMPLETED") {
    return (
      <Badge variant="secondary">
        <CheckCircle2 data-icon="inline-start" />
        已完成
      </Badge>
    )
  }

  if (status === "PENDING") {
    return (
      <Badge variant="outline">
        <ReceiptText data-icon="inline-start" />
        {expired ? "已过期" : "待支付"}
      </Badge>
    )
  }

  if (status === "PROCESSING") {
    return <Badge variant="outline">处理中</Badge>
  }

  if (status === "FAILED") {
    return <Badge variant="outline">失败</Badge>
  }

  if (status === "CANCELLED") {
    return <Badge variant="outline">已取消</Badge>
  }

  return <Badge variant="outline">已退款</Badge>
}

function PaymentApplicationStatusBadge({ status }: { status: PaymentApplicationListItem["status"] }) {
  if (status === "ACTIVE") {
    return <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">已通过</Badge>
  }

  if (status === "REJECTED") {
    return <Badge className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">已驳回</Badge>
  }

  if (status === "DISABLED") {
    return <Badge className="border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">已禁用</Badge>
  }

  return <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">待审核</Badge>
}
