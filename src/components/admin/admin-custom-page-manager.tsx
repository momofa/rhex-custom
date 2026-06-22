"use client"

import Link from "next/link"
import { ArrowUpRight, FileCode2, Globe, LayoutTemplate, Loader2, PanelBottom, PanelLeft, PanelRight, PanelTop, Plus, Save, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { FormModal } from "@/components/ui/modal"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAdminMutation } from "@/hooks/use-admin-mutation"
import type { AdminCustomPageItem } from "@/lib/admin-custom-pages"
import { adminGet, adminPost } from "@/lib/admin-client"
import { getCustomPageRoutePreview } from "@/lib/custom-page-types"
import { cn } from "@/lib/utils"

interface AdminCustomPageManagerProps {
  initialItems: AdminCustomPageItem[]
}

type DraftStatus = "DRAFT" | "PUBLISHED" | "OFFLINE"

interface CustomPageDraft {
  id?: string
  title: string
  routePath: string
  htmlContent: string
  status: DraftStatus
  includeHeader: boolean
  includeFooter: boolean
  includeLeftSidebar: boolean
  includeRightSidebar: boolean
}

interface StatusAction {
  status: DraftStatus
  label: string
  variant: "default" | "outline" | "ghost"
}

const EMPTY_DRAFT: CustomPageDraft = {
  title: "",
  routePath: "",
  htmlContent: "",
  status: "DRAFT",
  includeHeader: true,
  includeFooter: true,
  includeLeftSidebar: false,
  includeRightSidebar: false,
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string"
}

function isAdminCustomPageItem(value: unknown): value is AdminCustomPageItem {
  if (!value || typeof value !== "object") {
    return false
  }

  const item = value as Partial<AdminCustomPageItem>
  return typeof item.id === "string"
    && typeof item.title === "string"
    && typeof item.routePath === "string"
    && typeof item.htmlContent === "string"
    && typeof item.summaryText === "string"
    && (item.status === "DRAFT" || item.status === "PUBLISHED" || item.status === "OFFLINE")
    && typeof item.includeHeader === "boolean"
    && typeof item.includeFooter === "boolean"
    && typeof item.includeLeftSidebar === "boolean"
    && typeof item.includeRightSidebar === "boolean"
    && typeof item.isBuiltin === "boolean"
    && typeof item.createdAt === "string"
    && typeof item.createdAtText === "string"
    && isNullableString(item.publishedAt)
    && isNullableString(item.publishedAtText)
    && typeof item.creatorName === "string"
}

function isAdminCustomPageList(value: unknown): value is AdminCustomPageItem[] {
  return Array.isArray(value) && value.every(isAdminCustomPageItem)
}

function getAvailableStatusActions(status: DraftStatus): StatusAction[] {
  if (status === "PUBLISHED") {
    return [
      { status: "DRAFT", label: "转草稿", variant: "outline" },
      { status: "OFFLINE", label: "下线", variant: "ghost" },
    ]
  }

  if (status === "OFFLINE") {
    return [
      { status: "PUBLISHED", label: "发布", variant: "default" },
      { status: "DRAFT", label: "转草稿", variant: "outline" },
    ]
  }

  return [
    { status: "PUBLISHED", label: "发布", variant: "default" },
    { status: "OFFLINE", label: "下线", variant: "ghost" },
  ]
}

export function AdminCustomPageManager({ initialItems }: AdminCustomPageManagerProps) {
  const [items, setItems] = useState(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<CustomPageDraft>(EMPTY_DRAFT)
  const [editingDrafts, setEditingDrafts] = useState<Record<string, CustomPageDraft>>(() => Object.fromEntries(initialItems.map((item) => [item.id, toDraft(item)])))
  const { isPending, runMutation } = useAdminMutation()

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.status === "PUBLISHED").length,
    chromeEnabled: items.filter((item) => item.includeHeader || item.includeFooter || item.includeLeftSidebar || item.includeRightSidebar).length,
    fullScreen: items.filter((item) => !item.includeHeader && !item.includeFooter && !item.includeLeftSidebar && !item.includeRightSidebar).length,
  }), [items])

  function updateCreateDraft<K extends keyof CustomPageDraft>(key: K, value: CustomPageDraft[K]) {
    setCreateDraft((current) => ({ ...current, [key]: value }))
  }

  function updateEditingDraft<K extends keyof CustomPageDraft>(id: string, key: K, value: CustomPageDraft[K]) {
    setEditingDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? EMPTY_DRAFT),
        [key]: value,
      },
    }))
  }

  function syncItems(nextItems: AdminCustomPageItem[]) {
    setItems(nextItems)
    setEditingDrafts(Object.fromEntries(nextItems.map((item) => [item.id, toDraft(item)])))
  }

  async function refreshList() {
    const result = await adminGet<AdminCustomPageItem[]>("/api/admin/custom-pages", {
      cache: "no-store",
      validateData: isAdminCustomPageList,
      invalidDataMessage: "自定义页面列表返回格式不正确",
      defaultErrorMessage: "刷新自定义页面列表失败",
    })

    syncItems(result.data)
  }

  function runCustomPageMutation(
    body: Record<string, unknown>,
    options: {
      successTitle: string
      errorTitle: string
      successMessage: string
      errorMessage: string
      onSuccess?: () => void | Promise<void>
    },
  ) {
    runMutation({
      mutation: async () => {
        const result = await adminPost("/api/admin/custom-pages", body, {
          defaultSuccessMessage: options.successMessage,
          defaultErrorMessage: options.errorMessage,
        })

        await refreshList()
        return result
      },
      successTitle: options.successTitle,
      errorTitle: options.errorTitle,
      refreshRouter: true,
      onSuccess: async () => {
        await options.onSuccess?.()
      },
    })
  }

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    runCustomPageMutation({ action: "save", ...createDraft }, {
      successTitle: "创建成功",
      errorTitle: "创建失败",
      successMessage: "自定义页面已创建",
      errorMessage: "自定义页面创建失败",
      onSuccess: () => {
        setCreateDraft(EMPTY_DRAFT)
        setCreateOpen(false)
      },
    })
  }

  function submitUpdate(id: string) {
    const draft = editingDrafts[id]
    if (!draft) {
      return
    }

    runCustomPageMutation({ action: "save", id, ...draft }, {
      successTitle: "保存成功",
      errorTitle: "保存失败",
      successMessage: "自定义页面已更新",
      errorMessage: "自定义页面保存失败",
      onSuccess: () => {
        setEditingId(null)
      },
    })
  }

  function submitDelete(id: string) {
    runCustomPageMutation({ action: "delete", id }, {
      successTitle: "删除成功",
      errorTitle: "删除失败",
      successMessage: "自定义页面已删除",
      errorMessage: "自定义页面删除失败",
      onSuccess: () => {
        if (editingId === id) {
          setEditingId(null)
        }
      },
    })
  }

  function submitStatus(id: string, status: DraftStatus) {
    runCustomPageMutation({ action: "update-status", id, status }, {
      successTitle: "操作成功",
      errorTitle: "操作失败",
      successMessage: "自定义页面状态已更新",
      errorMessage: "自定义页面状态更新失败",
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>自定义页面管理</CardTitle>
          <CardDescription>发布独立站点页面，支持直达路由、原生 HTML，以及页头页脚与左右侧栏开关。</CardDescription>
          <CardAction>
            <Button type="button" className="rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />新增自定义页面
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="py-4">
          <AdminSummaryStrip
            items={[
              { label: "页面总数", value: stats.total, icon: <FileCode2 className="h-4 w-4" /> },
              { label: "已发布", value: stats.published, icon: <Globe className="h-4 w-4" />, tone: "emerald" },
              { label: "带全局外壳", value: stats.chromeEnabled, icon: <LayoutTemplate className="h-4 w-4" />, tone: "sky" },
              { label: "纯净页面", value: stats.fullScreen, icon: <PanelBottom className="h-4 w-4" />, tone: "amber" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>页面列表</CardTitle>
          <CardDescription>注意：数据库里的 `class` 不会触发 Tailwind 生成样式，如需自定义样式请优先使用原生 HTML 和 inline style。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-4">
          {items.map((item) => {
            const activeEditing = editingId === item.id
            const draft = editingDrafts[item.id] ?? toDraft(item)

            return (
              <Card key={item.id} size="sm" className="py-0">
                <CardContent className="py-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-semibold">{item.title}</h4>
                        <StatusBadge status={item.status} />
                        {item.isBuiltin ? <Badge variant="secondary">内置</Badge> : null}
                        <ChromeBadge enabled={item.includeHeader} icon={<PanelTop className="h-3 w-3" />} label="顶部" />
                        <ChromeBadge enabled={item.includeFooter} icon={<PanelBottom className="h-3 w-3" />} label="底部" />
                        <ChromeBadge enabled={item.includeLeftSidebar} icon={<PanelLeft className="h-3 w-3" />} label="左侧栏" />
                        <ChromeBadge enabled={item.includeRightSidebar} icon={<PanelRight className="h-3 w-3" />} label="右侧栏" />
                      </div>

                      <p className="mt-1 text-xs leading-6 text-muted-foreground">{item.summaryText || "HTML 页面暂无可提取的预览文字。"}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>创建人：{item.creatorName}</span>
                        <span>·</span>
                        <span>创建于 {item.createdAtText}</span>
                        <span>·</span>
                        <span>{item.publishedAtText ? `发布时间 ${item.publishedAtText}` : "未发布"}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground">访问地址：</span>
                        <Link href={item.routePath} className="inline-flex items-center gap-1 text-primary underline underline-offset-4">
                          {item.routePath}
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setEditingId(activeEditing ? null : item.id)}>
                        {activeEditing ? "收起" : "编辑"}
                      </Button>
                      <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" disabled={isPending || item.isBuiltin} onClick={() => submitDelete(item.id)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" />{item.isBuiltin ? "内置页面" : "删除"}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {getAvailableStatusActions(item.status).map((action) => (
                      <Button
                        key={`${item.id}-${action.status}`}
                        type="button"
                        variant={action.variant}
                        className="h-8 rounded-full px-3 text-xs"
                        disabled={isPending}
                        onClick={() => submitStatus(item.id, action.status)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>

                  {activeEditing ? (
                    <EditorForm
                      draft={draft}
                      isPending={isPending}
                      routePathReadonly={item.isBuiltin}
                      onChange={(key, value) => updateEditingDraft(item.id, key, value)}
                      onSubmit={() => submitUpdate(item.id)}
                    />
                  ) : null}
                </CardContent>
              </Card>
            )
          })}

          {items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有自定义页面，创建后即可通过独立路径直接访问。</p> : null}
        </CardContent>
      </Card>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={submitCreate}
        title="新增自定义页面"
        description="适合落地单页、活动页、落地页或无帖子依赖的独立内容页。"
        size="lg"
        closeDisabled={isPending}
        closeOnEscape={!isPending}
        footer={({ formId }) => (
          <div className="flex items-center gap-3">
            <Button type="submit" form={formId} disabled={isPending} className="rounded-full">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}创建自定义页面
            </Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setCreateOpen(false)}>取消</Button>
          </div>
        )}
      >
        <EditorFields draft={createDraft} onChange={updateCreateDraft} />
      </FormModal>
    </div>
  )
}

function EditorForm({
  draft,
  isPending,
  routePathReadonly = false,
  onChange,
  onSubmit,
}: {
  draft: CustomPageDraft
  isPending: boolean
  routePathReadonly?: boolean
  onChange: <K extends keyof CustomPageDraft>(key: K, value: CustomPageDraft[K]) => void
  onSubmit: () => void
}) {
  return (
    <div className="mt-3 grid gap-3 rounded-[18px] border border-border bg-background/70 p-3">
      <EditorFields draft={draft} routePathReadonly={routePathReadonly} onChange={onChange} />
      <div className="flex justify-end">
        <Button type="button" disabled={isPending} className="rounded-full" onClick={onSubmit}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存自定义页面
        </Button>
      </div>
    </div>
  )
}

function EditorFields({
  draft,
  routePathReadonly = false,
  onChange,
}: {
  draft: CustomPageDraft
  routePathReadonly?: boolean
  onChange: <K extends keyof CustomPageDraft>(key: K, value: CustomPageDraft[K]) => void
}) {
  const previewRoute = getCustomPageRoutePreview(draft.routePath)

  return (
    <>
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Field label="页面标题">
          <Input value={draft.title} onChange={(event) => onChange("title", event.target.value)} className="h-10 rounded-[16px] bg-background px-3" placeholder="如 落地页 / 活动页 / 说明页" />
        </Field>
        <Field label="发布状态">
          <Select value={draft.status} onValueChange={(value) => onChange("status", value as DraftStatus)}>
            <SelectTrigger className="h-10 rounded-[16px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">草稿</SelectItem>
              <SelectItem value="PUBLISHED">已发布</SelectItem>
              <SelectItem value="OFFLINE">已下线</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="自定义路由">
        <Input
          value={draft.routePath}
          onChange={(event) => onChange("routePath", event.target.value)}
          className="h-10 rounded-[16px] bg-background px-3"
          placeholder="如 /landing 或 /campaign/summer"
          disabled={routePathReadonly}
        />
      </Field>

      <div className="rounded-[16px] border border-dashed border-border bg-background px-3 py-3 text-xs leading-6 text-muted-foreground">
        <span className="font-medium text-foreground">最终访问路径：</span>
        <span className="ml-1 break-all">{previewRoute}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CheckItem checked={draft.includeHeader} onChange={(checked) => onChange("includeHeader", checked)} label="显示顶部" />
        <CheckItem checked={draft.includeFooter} onChange={(checked) => onChange("includeFooter", checked)} label="显示底部" />
        <CheckItem checked={draft.includeLeftSidebar} onChange={(checked) => onChange("includeLeftSidebar", checked)} label="显示左侧栏" />
        <CheckItem checked={draft.includeRightSidebar} onChange={(checked) => onChange("includeRightSidebar", checked)} label="显示右侧栏" />
      </div>

      <Field label="HTML 内容">
        <Textarea
          value={draft.htmlContent}
          onChange={(event) => onChange("htmlContent", event.target.value)}
          className="min-h-[320px] rounded-[20px] bg-background px-4 py-3 font-mono text-xs leading-6"
          placeholder={`<section style="padding:48px 24px;">\n  <h1>自定义页面</h1>\n  <p>这里直接填写 HTML。</p>\n</section>`}
        />
      </Field>
    </>
  )
}

function toDraft(item: AdminCustomPageItem): CustomPageDraft {
  return {
    id: item.id,
    title: item.title,
    routePath: item.routePath,
    htmlContent: item.htmlContent,
    status: item.status,
    includeHeader: item.includeHeader,
    includeFooter: item.includeFooter,
    includeLeftSidebar: item.includeLeftSidebar,
    includeRightSidebar: item.includeRightSidebar,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function StatusBadge({ status }: { status: DraftStatus }) {
  if (status === "PUBLISHED") {
    return <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">已发布</Badge>
  }

  if (status === "OFFLINE") {
    return <Badge className="border-transparent bg-slate-200 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">已下线</Badge>
  }

  return <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">草稿</Badge>
}

function ChromeBadge({ enabled, icon, label }: { enabled: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Badge className={cn("border-transparent", enabled ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300")}>
      {icon}
      {label}
    </Badge>
  )
}

function CheckItem({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <Button type="button" variant={checked ? "default" : "outline"} className={cn("h-10 rounded-[16px] justify-start px-3 text-sm", checked ? "" : "text-muted-foreground")} onClick={() => onChange(!checked)}>
      {label}
    </Button>
  )
}
