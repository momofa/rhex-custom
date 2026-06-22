"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Copy, KeyRound, Pencil, RotateCcw, ShieldOff, XCircle } from "lucide-react"

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
import { formatDateTime } from "@/lib/formatters"
import type { OAuthClientAdminPageData, OAuthClientListItem } from "@/lib/oauth-server"

interface OAuthServerAdminPageProps {
  initialData: OAuthClientAdminPageData
  basePath?: string
  settingsHref?: string
}

const statusOptions = [
  { value: "ALL", label: "全部状态" },
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "DISABLED", label: "已禁用" },
]

const pageSizeOptions = [20, 50, 100]

interface OAuthClientEditFormState {
  name: string
  description: string
  homepageUrl: string
  logoUrl: string
  redirectUris: string
  scopes: string[]
}

const scopeOptions = [
  { value: "openid", label: "openid", description: "基础身份标识，必须包含。" },
  { value: "profile", label: "profile", description: "用户名、昵称、头像等公开资料。" },
  { value: "email", label: "email", description: "邮箱和邮箱验证状态。" },
]

function getInitialEditForm(client: OAuthClientListItem): OAuthClientEditFormState {
  return {
    name: client.name,
    description: client.description,
    homepageUrl: client.homepageUrl,
    logoUrl: client.logoUrl,
    redirectUris: client.redirectUris.join("\n"),
    scopes: client.scopes.length ? client.scopes : ["openid", "profile", "email"],
  }
}

export function OAuthServerAdminPage({
  initialData,
  basePath = "/admin/settings/oauth/clients",
  settingsHref = "/admin/settings/oauth/settings",
}: OAuthServerAdminPageProps) {
  const router = useRouter()
  const [reviewTarget, setReviewTarget] = useState<OAuthClientListItem | null>(null)
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "disable" | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [editTarget, setEditTarget] = useState<OAuthClientListItem | null>(null)
  const [editForm, setEditForm] = useState<OAuthClientEditFormState | null>(null)
  const [secretModal, setSecretModal] = useState<{ clientId: string; clientSecret: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const baseQuery = useMemo(() => new URLSearchParams({
    keyword: initialData.filters.keyword,
    status: initialData.filters.status,
    pageSize: String(initialData.pagination.pageSize),
  }), [initialData.filters.keyword, initialData.filters.status, initialData.pagination.pageSize])

  function buildPageHref(page: number) {
    const query = new URLSearchParams(baseQuery)
    query.set("page", String(page))
    return `${basePath}?${query.toString()}`
  }

  function openReviewModal(client: OAuthClientListItem, action: "approve" | "reject" | "disable") {
    setReviewTarget(client)
    setReviewAction(action)
    setReviewNote(client.reviewNote ?? "")
  }

  function closeReviewModal() {
    if (isPending) {
      return
    }

    setReviewTarget(null)
    setReviewAction(null)
    setReviewNote("")
  }

  function openEditModal(client: OAuthClientListItem) {
    setEditTarget(client)
    setEditForm(getInitialEditForm(client))
  }

  function closeEditModal() {
    if (isPending) {
      return
    }

    setEditTarget(null)
    setEditForm(null)
  }

  function updateEditForm<Key extends keyof OAuthClientEditFormState>(field: Key, value: OAuthClientEditFormState[Key]) {
    setEditForm((current) => current ? { ...current, [field]: value } : current)
  }

  function toggleEditScope(scope: string, checked: boolean) {
    setEditForm((current) => {
      if (!current) {
        return current
      }

      const next = checked
        ? Array.from(new Set([...current.scopes, scope]))
        : current.scopes.filter((item) => item !== scope)

      return {
        ...current,
        scopes: next.includes("openid") ? next : ["openid", ...next],
      }
    })
  }

  function submitEdit() {
    if (!editTarget || !editForm) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/oauth-server/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            id: editTarget.id,
            name: editForm.name,
            description: editForm.description,
            homepageUrl: editForm.homepageUrl,
            logoUrl: editForm.logoUrl,
            redirectUris: editForm.redirectUris,
            scopes: editForm.scopes,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "更新 OAuth 应用失败")
        }

        toast.success(result.message ?? "OAuth 应用已更新", "OAuth 应用")
        router.refresh()
        closeEditModal()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "更新 OAuth 应用失败", "OAuth 应用")
      }
    })
  }

  function submitReview() {
    if (!reviewTarget || !reviewAction) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/oauth-server/clients", {
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
          throw new Error(result?.message ?? "处理 OAuth 应用失败")
        }

        toast.success(result.message ?? "操作成功", "OAuth 应用")
        router.refresh()
        closeReviewModal()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "处理 OAuth 应用失败", "OAuth 应用")
      }
    })
  }

  function resetSecret(client: OAuthClientListItem) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/oauth-server/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rotate-secret",
            id: client.id,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "重置应用 key 失败")
        }

        setSecretModal({
          clientId: client.clientId,
          clientSecret: String(result.data?.clientSecret ?? ""),
        })
        toast.success("应用 key 已重置", "OAuth 应用")
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "重置应用 key 失败", "OAuth 应用")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="border-b">
          <div>
            <CardTitle>OAuth 授权服务</CardTitle>
            <CardDescription>审核用户申请的 OAuth 应用，控制 appid/key 生命周期，以及启用或禁用第三方接入。</CardDescription>
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
          { label: "应用总数", value: initialData.summary.total, icon: <KeyRound /> },
          { label: "待审核", value: initialData.summary.pending, icon: <KeyRound />, tone: "amber" },
          { label: "已通过", value: initialData.summary.approved, icon: <CheckCircle2 />, tone: "emerald" },
          { label: "已驳回", value: initialData.summary.rejected, icon: <XCircle />, tone: "rose" },
          { label: "已禁用", value: initialData.summary.disabled, icon: <ShieldOff /> },
        ]}
      />

      <form className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[minmax(180px,1fr)_160px_120px_auto]">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">搜索应用</span>
          <input name="keyword" defaultValue={initialData.filters.keyword} placeholder="应用名 / appid / 申请人" className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" />
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
          <CardTitle>应用列表</CardTitle>
          <CardDescription>通过后应用即可调用 `/oauth/authorize`、`/oauth/token` 和 `/oauth/userinfo`。</CardDescription>
          <CardAction>
            <Badge variant="secondary" className="rounded-full">当前 {initialData.clients.length} 条</Badge>
          </CardAction>
        </CardHeader>
        {initialData.clients.length > 0 ? (
          <AdminPaginationBar pagination={initialData.pagination} buildPageHref={buildPageHref} itemLabel="个应用" className="border-b border-border px-4 py-3" />
        ) : null}
        <CardContent className="px-0 py-0">
          {initialData.clients.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有 OAuth 应用。</div>
          ) : (
            <div className="divide-y divide-border">
              {initialData.clients.map((client) => (
                <article key={client.id} className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.4fr)_240px_220px_260px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{client.name}</h3>
                      <OAuthClientStatusBadge status={client.status} />
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">appid: <code>{client.clientId}</code></p>
                    {client.description ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{client.description}</p> : null}
                    {client.reviewNote ? <p className="mt-2 text-xs text-amber-700">审核备注：{client.reviewNote}</p> : null}
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <p>申请人：{client.owner?.displayName ?? "未知"} @{client.owner?.username ?? "-"}</p>
                    <p>账号状态：{client.owner?.status ?? "-"}</p>
                    <p>创建：{formatDateTime(client.createdAt)}</p>
                    <p>更新：{formatDateTime(client.updatedAt)}</p>
                  </div>
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                    <p>Scopes：{client.scopes.join(" ")}</p>
                    <p>回调地址：</p>
                    <div className="flex flex-col gap-1">
                      {client.redirectUris.slice(0, 3).map((uri) => <code key={uri} className="break-all">{uri}</code>)}
                      {client.redirectUris.length > 3 ? <span>另 {client.redirectUris.length - 3} 个</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => openEditModal(client)}>
                      <Pencil data-icon="inline-start" />
                      编辑
                    </Button>
                    {client.status === "PENDING" ? (
                      <>
                        <Button type="button" disabled={isPending} onClick={() => openReviewModal(client, "approve")}>通过</Button>
                        <Button type="button" variant="outline" disabled={isPending} onClick={() => openReviewModal(client, "reject")}>驳回</Button>
                      </>
                    ) : null}
                    {client.status === "APPROVED" ? (
                      <Button type="button" variant="outline" disabled={isPending} onClick={() => openReviewModal(client, "disable")}>禁用</Button>
                    ) : null}
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => resetSecret(client)}>
                      <RotateCcw data-icon="inline-start" />
                      重置 key
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
        <AdminPaginationBar pagination={initialData.pagination} buildPageHref={buildPageHref} itemLabel="个应用" className="border-t border-border px-4 py-3" />
      </Card>

      <ReviewModal
        target={reviewTarget}
        action={reviewAction}
        note={reviewNote}
        isPending={isPending}
        onNoteChange={setReviewNote}
        onClose={closeReviewModal}
        onSubmit={submitReview}
      />
      <EditClientModal
        target={editTarget}
        form={editForm}
        isPending={isPending}
        onChange={updateEditForm}
        onToggleScope={toggleEditScope}
        onClose={closeEditModal}
        onSubmit={submitEdit}
      />
      <SecretOnceModal secret={secretModal} onClose={() => setSecretModal(null)} />
    </div>
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

function EditClientModal({
  target,
  form,
  isPending,
  onChange,
  onToggleScope,
  onClose,
  onSubmit,
}: {
  target: OAuthClientListItem | null
  form: OAuthClientEditFormState | null
  isPending: boolean
  onChange: <Key extends keyof OAuthClientEditFormState>(field: Key, value: OAuthClientEditFormState[Key]) => void
  onToggleScope: (scope: string, checked: boolean) => void
  onClose: () => void
  onSubmit: () => void
}) {
  if (!target || !form) {
    return null
  }

  return (
    <FormModal
      open
      title="编辑 OAuth 应用"
      description={`修改“${target.name}”的展示资料、回调地址和权限范围。appid/key 不会变化。`}
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
          <span className="text-sm font-medium">应用主页</span>
          <Input value={form.homepageUrl} onChange={(event) => onChange("homepageUrl", event.target.value)} placeholder="https://example.com" />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">应用描述</span>
        <Textarea value={form.description} onChange={(event) => onChange("description", event.target.value)} rows={3} placeholder="说明应用用途。" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Logo 地址</span>
        <Input value={form.logoUrl} onChange={(event) => onChange("logoUrl", event.target.value)} placeholder="https://example.com/logo.png" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">回调地址 *</span>
        <Textarea value={form.redirectUris} onChange={(event) => onChange("redirectUris", event.target.value)} rows={5} placeholder={"每行一个回调地址"} required />
        <span className="text-xs text-muted-foreground">授权请求中的 redirect_uri 必须与这里其中一项完全一致。</span>
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">权限范围</span>
        <div className="grid gap-2">
          {scopeOptions.map((scope) => (
            <label key={scope.value} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2">
              <input
                type="checkbox"
                checked={form.scopes.includes(scope.value)}
                disabled={scope.value === "openid"}
                onChange={(event) => onToggleScope(scope.value, event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{scope.label}</span>
                <span className="text-xs leading-5 text-muted-foreground">{scope.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
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
  target: OAuthClientListItem | null
  action: "approve" | "reject" | "disable" | null
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
      description={`处理 OAuth 应用“${target.name}”。`}
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
  secret: { clientId: string; clientSecret: string } | null
  onClose: () => void
}) {
  if (!secret) {
    return null
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} 已复制`, "OAuth 应用")
    } catch {
      toast.error("复制失败，请手动复制", "OAuth 应用")
    }
  }

  return (
    <Modal
      open
      title="新的应用 key"
      description="client_secret 只会显示这一次，关闭后无法再次查看。"
      onClose={onClose}
      footer={<Button type="button" onClick={onClose}>我已保存</Button>}
    >
      <div className="flex flex-col gap-3">
        <SecretRow label="appid / client_id" value={secret.clientId} onCopy={() => copy(secret.clientId, "client_id")} />
        <SecretRow label="key / client_secret" value={secret.clientSecret} onCopy={() => copy(secret.clientSecret, "client_secret")} />
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

function OAuthClientStatusBadge({ status }: { status: OAuthClientListItem["status"] }) {
  if (status === "APPROVED") {
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
