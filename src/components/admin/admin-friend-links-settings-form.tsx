"use client"

import Image from "next/image"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Loader2, Plus, Trash2, Upload } from "lucide-react"

import {
  SettingsInputField,
  SettingsSection,
  SettingsTextareaField,
  SettingsToggleField,
} from "@/components/admin/admin-settings-fields"
import { FormModal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import type { FriendLinkItem } from "@/lib/friend-links"

interface AdminFriendLinksSettingsFormProps {
  initialSettings: {
    friendLinksEnabled: boolean
    friendLinkApplicationEnabled: boolean
    friendLinkAnnouncement: string
  }
  items: FriendLinkItem[]
  pendingCount: number
}

interface FriendLinkDraft {
  name: string
  url: string
  logoPath: string
  sortOrder: string
  reviewNote: string
}

const EMPTY_DRAFT: FriendLinkDraft = {
  name: "",
  url: "",
  logoPath: "",
  sortOrder: "0",
  reviewNote: "",
}

export function AdminFriendLinksSettingsForm({ initialSettings, items, pendingCount }: AdminFriendLinksSettingsFormProps) {
  const router = useRouter()
  const [friendLinksEnabled, setFriendLinksEnabled] = useState(initialSettings.friendLinksEnabled)
  const [friendLinkApplicationEnabled, setFriendLinkApplicationEnabled] = useState(initialSettings.friendLinkApplicationEnabled)
  const [friendLinkAnnouncement, setFriendLinkAnnouncement] = useState(initialSettings.friendLinkAnnouncement)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createDraft, setCreateDraft] = useState<FriendLinkDraft>(EMPTY_DRAFT)
  const [editingDrafts, setEditingDrafts] = useState<Record<string, FriendLinkDraft>>(() => Object.fromEntries(items.map((item) => [item.id, toDraft(item)])))
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateCreateDraft<K extends keyof FriendLinkDraft>(key: K, value: FriendLinkDraft[K]) {
    setCreateDraft((current) => ({ ...current, [key]: value }))
  }

  function updateEditingDraft<K extends keyof FriendLinkDraft>(id: string, key: K, value: FriendLinkDraft[K]) {
    setEditingDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? EMPTY_DRAFT),
        [key]: value,
      },
    }))
  }

  async function uploadLogo(file: File, target: "create" | string) {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片格式的 LOGO 文件", "上传失败")
      return
    }

    setUploadingTarget(target)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "friend-links")

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.message ?? "LOGO 上传失败", "上传失败")
        return
      }

      const logoPath = String(result.data?.urlPath ?? "")
      if (target === "create") {
        updateCreateDraft("logoPath", logoPath)
      } else {
        updateEditingDraft(target, "logoPath", logoPath)
      }
      toast.success("LOGO 上传成功", "上传成功")
    } catch {
      toast.error("LOGO 上传失败，请稍后重试", "上传失败")
    } finally {
      setUploadingTarget(null)
    }
  }

  function submitSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const response = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "site-friend-links",
          friendLinksEnabled,
          friendLinkApplicationEnabled,
          friendLinkAnnouncement,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "友情链接设置保存失败", "保存失败")
        return
      }
      toast.success(result.message ?? "友情链接设置已保存", "保存成功")
      router.refresh()
    })
  }

  function createFriendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const response = await fetch("/api/admin/friend-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: createDraft.name,
          url: createDraft.url,
          logoPath: createDraft.logoPath,
          sortOrder: Number(createDraft.sortOrder || 0),
          reviewNote: createDraft.reviewNote,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "新增友情链接失败", "新增失败")
        return
      }

      toast.success(result.message ?? "友情链接已创建", "新增成功")
      setCreateDraft(EMPTY_DRAFT)
      setCreateOpen(false)
      router.refresh()
    })
  }

  function submitReview(id: string, action: "approve" | "reject" | "disable" | "update") {
    const draft = editingDrafts[id] ?? EMPTY_DRAFT
    startTransition(async () => {
      const response = await fetch("/api/admin/friend-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          name: draft.name,
          url: draft.url,
          logoPath: draft.logoPath,
          reviewNote: draft.reviewNote,
          sortOrder: Number(draft.sortOrder || 0),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "操作失败", "操作失败")
        return
      }
      toast.success(result.message ?? "操作成功", "操作成功")
      setEditingId(null)
      router.refresh()
    })
  }

  function deleteFriendLink(id: string, name: string) {
    if (!window.confirm(`确定删除友情链接「${name}」吗？此操作不可恢复。`)) {
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/friend-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "delete",
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "删除友情链接失败", "删除失败")
        return
      }

      toast.success(result.message ?? "友情链接已删除", "删除成功")
      setEditingId((current) => current === id ? null : current)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submitSettings} className="space-y-4">
        <SettingsSection
          title="友情链接设置"
          description="控制首页展示、申请开关与公告内容。"
          action={(
            <Button type="button" className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />新增友情链接
            </Button>
          )}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <SettingsToggleField label="开启友情链接" description="关闭后首页与 /link 页面不展示友情链接。" checked={friendLinksEnabled} onChange={setFriendLinksEnabled} />
            <SettingsToggleField label="开启申请入口" description={`当前待审核 ${pendingCount} 条。`} checked={friendLinkApplicationEnabled} onChange={setFriendLinkApplicationEnabled} />
          </div>
          <SettingsTextareaField
            label="友情链接公告"
            value={friendLinkAnnouncement}
            onChange={setFriendLinkAnnouncement}
            placeholder="填写友情链接公告，将显示在申请弹窗与友情链接页中。"
            rows={5}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存设置"}</Button>
          </div>
        </SettingsSection>
      </form>

      <SettingsSection
        title="友情链接列表"
        description="更紧凑的卡片列表，展开后再编辑详情。"
        action={<Badge className="border-transparent bg-amber-100 text-amber-700">待审核 {pendingCount}</Badge>}
      >

        <div className="space-y-3">
          {items.map((item) => {
            const activeEditing = editingId === item.id
            const draft = editingDrafts[item.id] ?? toDraft(item)

            return (
              <article key={item.id} className="rounded-2xl bg-muted/35 px-4 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                      {draft.logoPath ? <Image src={draft.logoPath} alt={`${draft.name || item.name} logo`} fill sizes="44px" className="object-contain p-1.5" unoptimized /> : <span className="text-sm font-semibold text-muted-foreground">{(draft.name || item.name).slice(0, 1)}</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-semibold">{item.name}</h4>
                        <StatusBadge status={item.status} />
                        {item.status === "APPROVED" ? <span className="text-[11px] text-emerald-600">首页可见</span> : null}
                      </div>

                      <p className="truncate text-xs text-muted-foreground">{item.url}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Input value={draft.sortOrder} onChange={(event) => updateEditingDraft(item.id, "sortOrder", event.target.value)} className="h-9 w-20 rounded-full bg-background px-3 text-xs" placeholder="排序" />
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setEditingId(activeEditing ? null : item.id)}>
                      {activeEditing ? "收起" : "编辑"}
                    </Button>
                    {item.status === "PENDING" ? (
                      <>
                        <Button type="button" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "approve")}>通过</Button>
                        <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "reject")}>驳回</Button>
                      </>
                    ) : null}
                    {item.status === "REJECTED" || item.status === "DISABLED" ? (
                      <Button type="button" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "approve")}>通过</Button>
                    ) : null}
                    {item.status === "APPROVED" ? (
                      <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "disable")}>停用</Button>
                    ) : null}
                    <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" disabled={isPending} onClick={() => deleteFriendLink(item.id, item.name)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </div>

                {activeEditing ? (
                  <div className="mt-3 grid gap-3 rounded-2xl bg-background/70 p-3 lg:grid-cols-[1fr_1fr]">
                    <SettingsInputField label="网站名称" value={draft.name} onChange={(value) => updateEditingDraft(item.id, "name", value)} />
                    <SettingsInputField label="网站链接" value={draft.url} onChange={(value) => updateEditingDraft(item.id, "url", value)} />
                    <div className="lg:col-span-2">
                      <Field label="LOGO">
                        <LogoUploader
                          value={draft.logoPath}
                          uploading={uploadingTarget === item.id}
                          onValueChange={(value) => updateEditingDraft(item.id, "logoPath", value)}
                          onUpload={(file) => uploadLogo(file, item.id)}
                        />
                      </Field>
                    </div>
                    <div className="lg:col-span-2">
                      <SettingsTextareaField label="审核备注" value={draft.reviewNote} onChange={(value) => updateEditingDraft(item.id, "reviewNote", value)} placeholder="填写审核备注，例如驳回原因、补充说明等。" rows={4} />
                    </div>
                    <div className="lg:col-span-2 flex justify-end">
                      <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "update")}>保存编辑</Button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
          {items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有友情链接记录。</p> : null}
        </div>
      </SettingsSection>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createFriendLink}
        title="新增友情链接"
        description="管理员可直接创建友情链接，默认创建为已通过状态。"
        closeDisabled={isPending}
        closeOnEscape={!isPending}
        footer={({ formId }) => (
          <div className="flex items-center gap-3">
            <Button type="submit" form={formId} disabled={isPending}>{isPending ? "提交中..." : "新增友情链接"}</Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setCreateOpen(false)}>取消</Button>
          </div>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsInputField label="网站名称" value={createDraft.name} onChange={(value) => updateCreateDraft("name", value)} placeholder="请输入网站名称" />
          <SettingsInputField label="网站链接" value={createDraft.url} onChange={(value) => updateCreateDraft("url", value)} placeholder="请输入网站地址（以 http 开头）" />
          <SettingsInputField label="排序值" value={createDraft.sortOrder} onChange={(value) => updateCreateDraft("sortOrder", value)} placeholder="数字越小越靠前" />
        </div>
        <Field label="LOGO">
          <LogoUploader
            value={createDraft.logoPath}
            uploading={uploadingTarget === "create"}
            onValueChange={(value) => updateCreateDraft("logoPath", value)}
            onUpload={(file) => uploadLogo(file, "create")}
          />
        </Field>
        <SettingsTextareaField label="备注" value={createDraft.reviewNote} onChange={(value) => updateCreateDraft("reviewNote", value)} placeholder="例如：首页推荐、合作来源等。" rows={5} />
      </FormModal>
    </div>
  )
}

function toDraft(item: FriendLinkItem): FriendLinkDraft {
  return {
    name: item.name,
    url: item.url,
    logoPath: item.logoPath ?? "",
    sortOrder: String(item.sortOrder),
    reviewNote: item.reviewNote ?? "",
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function LogoUploader({ value, uploading, onValueChange, onUpload }: { value: string; uploading: boolean; onValueChange: (value: string) => void; onUpload: (file: File) => void }) {
  return (
    <div className="space-y-3 rounded-2xl bg-muted/35 p-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "上传中..." : "上传 LOGO"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              onUpload(file)
            }
            event.target.value = ""
          }}
        />
      </label>
      <Input value={value} onChange={(event) => onValueChange(event.target.value)} className="h-10 rounded-xl bg-background px-3 text-sm" placeholder="或直接填写 LOGO 地址" />
      {value ? (
        <div className="relative h-14 w-36 overflow-hidden rounded-xl border border-border bg-white p-2">
          <Image src={value} alt="友情链接 LOGO" fill sizes="144px" className="object-contain p-2" unoptimized />
        </div>
      ) : null}

    </div>
  )
}

function StatusBadge({ status }: { status: FriendLinkItem["status"] }) {
  const className = status === "APPROVED"
    ? "bg-emerald-100 text-emerald-700"
    : status === "REJECTED"
      ? "bg-rose-100 text-rose-700"
      : status === "DISABLED"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-100 text-amber-700"

  const label = status === "APPROVED"
    ? "已通过"
    : status === "REJECTED"
      ? "已驳回"
      : status === "DISABLED"
        ? "已停用"
        : "待审核"

  return <Badge className={`rounded-full border-transparent px-2.5 py-1 text-[11px] ${className}`}>{label}</Badge>
}

