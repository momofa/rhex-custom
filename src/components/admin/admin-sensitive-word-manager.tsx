"use client"

import { useRouter } from "next/navigation"
import { Ban, Shield, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { AdminPaginationBar } from "@/components/admin/admin-pagination-bar"
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { showConfirm } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime, formatNumber } from "@/lib/formatters"

interface SensitiveWordItem {
  id: string
  word: string
  matchType: string
  actionType: string
  status: boolean
  createdAt: string
}

interface AdminSensitiveWordManagerProps {
  data: {
    words: SensitiveWordItem[]
    summary: {
      total: number
      active: number
      reject: number
      replace: number
    }
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
      hasPrevPage: boolean
      hasNextPage: boolean
    }
  }
}

const text = {
  totalRules: "规则总数",
  activeRules: "启用规则",
  rejectRules: "直接拦截",
  replaceRules: "自动替换",
  addTitle: "新增敏感词规则",
  addDescription: "支持一行一个批量新增，当前只保留拦截和替换两种处理方式。",
  placeholder: "输入敏感词、短语或正则表达式，支持批量粘贴，一行一个",
  emptyWord: "敏感词不能为空",
  saveSuccess: "保存成功",
  saveFailed: "保存失败",
  saving: "保存中...",
  addOne: "新增规则",
  addMany: "批量新增",
  libraryTitle: "敏感词库",
  libraryDescription: "统一管理拦截与替换规则，旧的审核型规则会按拦截处理。",
  noRules: "当前还没有敏感词规则。",
  update: "更新",
  perPage: "页",
  selectedPrefix: "已选中",
  selectedSuffix: "条规则",
  batchHint: "可勾选多条规则进行批量管理",
  batchEnable: "批量启用",
  batchDisable: "批量停用",
  batchDelete: "批量删除",
  clearAll: "一键清空",
  clearSelection: "取消选择",
  selectCurrentPage: "选择当前页规则",
  word: "敏感词",
  matchType: "匹配方式",
  actionType: "处理方式",
  status: "状态",
  actions: "操作",
  enabled: "启用中",
  disabled: "已停用",
  enable: "启用",
  disable: "停用",
  delete: "删除",
  deleteTitle: "删除敏感词规则",
  deleteConfirm: "确认删除规则",
  deleteConfirmSuffix: "吗？删除后将立即失效。",
  batchDeleteTitle: "批量删除敏感词规则",
  batchDeleteConfirm: "确认删除已选中的",
  clearAllTitle: "清空敏感词库",
  clearAllConfirm: "确认清空全部敏感词规则吗？删除后所有敏感词拦截和替换规则将立即失效。",
  pagePrefix: "第",
  pageMiddle: "/",
  pageSuffix: "页",
  pageSizePrefix: "每页",
  pageSizeSuffix: "条",
  totalPrefix: "共",
  totalSuffix: "条规则",
  previousPage: "上一页",
  nextPage: "下一页",
  contains: "包含匹配",
  exact: "完全匹配",
  regex: "正则匹配",
  reject: "直接拦截",
  replace: "自动替换",
}

const matchTypeOptions = [
  { value: "CONTAINS", label: text.contains },
  { value: "EXACT", label: text.exact },
  { value: "REGEX", label: text.regex },
]

const actionTypeOptions = [
  { value: "REJECT", label: text.reject },
  { value: "REPLACE", label: text.replace },
]

export function AdminSensitiveWordManager({ data }: AdminSensitiveWordManagerProps) {
  const router = useRouter()
  const [wordInput, setWordInput] = useState("")
  const [matchType, setMatchType] = useState("CONTAINS")
  const [actionType, setActionType] = useState("REJECT")
  const [pageSize, setPageSize] = useState(String(data.pagination.pageSize))
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const summary = useMemo(() => data.summary, [data.summary])
  const batchCount = useMemo(() => {
    return new Set(wordInput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)).size
  }, [wordInput])
  const currentPageIds = useMemo(() => data.words.map((item) => item.id), [data.words])
  const selectedCount = selectedIds.length
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id))
  const someCurrentPageSelected = currentPageIds.some((id) => selectedIds.includes(id))

  function toggleSelectAllCurrentPage(checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) {
        return current.filter((id) => !currentPageIds.includes(id))
      }

      return [...new Set([...current, ...currentPageIds])]
    })
  }

  function toggleSelectOne(id: string, checked: boolean) {
    setSelectedIds((current) => checked
      ? [...new Set([...current, id])]
      : current.filter((item) => item !== id),
    )
  }

  async function createRule() {
    if (!wordInput.trim()) {
      setMessage(text.emptyWord)
      return
    }

    setSaving(true)
    setMessage("")
    const response = await fetch("/api/admin/sensitive-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: wordInput, matchType, actionType }),
    })
    const result = await response.json()
    setMessage(result.message ?? (response.ok ? text.saveSuccess : text.saveFailed))
    setSaving(false)
    if (response.ok) {
      setWordInput("")
      router.refresh()
    }
  }

  async function toggleStatus(id: string, status: boolean) {
    const response = await fetch("/api/admin/sensitive-words", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: !status }),
    })
    if (response.ok) {
      router.refresh()
    }
  }

  async function batchToggleStatus(status: boolean) {
    if (selectedIds.length === 0) {
      return
    }

    setSaving(true)
    await Promise.all(selectedIds.map((id) => fetch("/api/admin/sensitive-words", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })))
    setSaving(false)
    setSelectedIds([])
    router.refresh()
  }

  async function removeRule(id: string, wordLabel: string) {
    const confirmed = await showConfirm({
      title: text.deleteTitle,
      description: `${text.deleteConfirm}“${wordLabel}”${text.deleteConfirmSuffix}`,
      confirmText: text.delete,
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    const response = await fetch("/api/admin/sensitive-words", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (response.ok) {
      router.refresh()
    }
  }

  async function batchRemoveRules() {
    if (selectedIds.length === 0) {
      return
    }

    const confirmed = await showConfirm({
      title: text.batchDeleteTitle,
      description: `${text.batchDeleteConfirm} ${selectedIds.length} ${text.selectedSuffix}${text.deleteConfirmSuffix}`,
      confirmText: text.delete,
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setSaving(true)
    const response = await fetch("/api/admin/sensitive-words", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    })
    setSaving(false)
    if (response.ok) {
      setSelectedIds([])
      router.refresh()
    }
  }

  async function clearAllRules() {
    const confirmed = await showConfirm({
      title: text.clearAllTitle,
      description: text.clearAllConfirm,
      confirmText: text.clearAll,
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setSaving(true)
    const response = await fetch("/api/admin/sensitive-words", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearAll: true }),
    })
    setSaving(false)
    if (response.ok) {
      setSelectedIds([])
      router.refresh()
    }
  }

  function buildPageHref(page: number) {
    const search = new URLSearchParams({
      tab: "security",
      securityPage: String(page),
      securityPageSize: String(data.pagination.pageSize),
    })
    return `/admin?${search.toString()}`
  }

  return (
    <div className="space-y-4">
      <AdminSummaryStrip
        items={[
          { label: text.totalRules, value: summary.total, icon: <Shield className="h-4 w-4" /> },
          { label: text.activeRules, value: summary.active, icon: <ShieldCheck className="h-4 w-4" />, tone: "emerald" },
          { label: text.rejectRules, value: summary.reject, icon: <Ban className="h-4 w-4" />, tone: "rose" },
          { label: text.replaceRules, value: summary.replace, icon: <ShieldAlert className="h-4 w-4" />, tone: "amber" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>{text.addTitle}</CardTitle>
          <CardDescription>{text.addDescription}</CardDescription>
        </CardHeader>
        <CardContent className="py-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.6fr)_160px_160px_auto]">
            <div className="space-y-2">
              <Textarea
                value={wordInput}
                onChange={(event) => setWordInput(event.target.value)}
                placeholder={text.placeholder}
                rows={6}
                className="min-h-[132px] rounded-xl bg-background px-4 py-3"
              />
              <p className="text-xs text-muted-foreground">
                {`当前待新增 ${formatNumber(batchCount)} 条规则，重复词会自动跳过。`}
              </p>
            </div>
            <Select value={matchType} onValueChange={setMatchType}>
              <SelectTrigger className="h-10 rounded-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {matchTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger className="h-10 rounded-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actionTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" className="h-10 rounded-full px-4 text-xs" disabled={saving} onClick={createRule}>
              {saving ? text.saving : batchCount > 1 ? text.addMany : text.addOne}
            </Button>
          </div>
        </CardContent>
        {message ? (
          <CardFooter>
            <span className="text-sm text-muted-foreground">{message}</span>
          </CardFooter>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{text.libraryTitle}</CardTitle>
          <CardDescription>{text.libraryDescription}</CardDescription>
          <CardAction>
            <form action="/admin" className="flex items-center gap-2">
              <input type="hidden" name="tab" value="security" />
              <input type="hidden" name="securityPage" value="1" />
              <input type="hidden" name="securityPageSize" value={pageSize} />
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="h-8 w-[104px] rounded-full bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{`${size} / ${text.perPage}`}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm" className="rounded-full px-3 text-xs">{text.update}</Button>
            </form>
          </CardAction>
        </CardHeader>
        {data.words.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
            <div className="text-xs text-muted-foreground">
              {selectedCount > 0
                ? `${text.selectedPrefix} ${selectedCount} ${text.selectedSuffix}`
                : text.batchHint}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-full px-3 text-xs" disabled={selectedCount === 0 || saving} onClick={() => batchToggleStatus(true)}>
                {text.batchEnable}
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-full px-3 text-xs" disabled={selectedCount === 0 || saving} onClick={() => batchToggleStatus(false)}>
                {text.batchDisable}
              </Button>
              <Button type="button" size="sm" className="rounded-full bg-red-600 px-3 text-xs text-white hover:bg-red-500" disabled={selectedCount === 0 || saving} onClick={batchRemoveRules}>
                {text.batchDelete}
              </Button>
              <Button type="button" variant="destructive" size="sm" className="rounded-full px-3 text-xs" disabled={saving || data.pagination.total === 0} onClick={clearAllRules}>
                <Trash2 data-icon="inline-start" />
                {text.clearAll}
              </Button>
              {selectedCount > 0 ? (
                <Button type="button" variant="ghost" size="sm" className="rounded-full px-3 text-xs" disabled={saving} onClick={() => setSelectedIds([])}>
                  {text.clearSelection}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {data.words.length > 0 ? (
          <AdminPaginationBar
            pagination={data.pagination}
            buildPageHref={buildPageHref}
            itemLabel={text.totalSuffix}
            className="border-b border-border px-6 py-3"
            align="center"
            previousLabel={text.previousPage}
            nextLabel={text.nextPage}
          />
        ) : null}
        <CardContent className="px-0 py-0">
          {data.words.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">{text.noRules}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[52px]">
                    <Checkbox
                      checked={allCurrentPageSelected || someCurrentPageSelected}
                      onCheckedChange={(checked) => toggleSelectAllCurrentPage(checked === true)}
                      aria-label={text.selectCurrentPage}
                    />
                  </TableHead>
                  <TableHead>{text.word}</TableHead>
                  <TableHead className="w-[140px]">{text.matchType}</TableHead>
                  <TableHead className="w-[140px]">{text.actionType}</TableHead>
                  <TableHead className="w-[120px]">{text.status}</TableHead>
                  <TableHead className="w-[180px] text-right">{text.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.words.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={(checked) => toggleSelectOne(item.id, checked === true)}
                        aria-label={`选择规则 ${item.word}`}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.word}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline">{getMatchTypeLabel(item.matchType)}</Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline">{getActionTypeLabel(item.actionType)}</Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge className={item.status ? "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"}>
                        {item.status ? text.enabled : text.disabled}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => toggleStatus(item.id, item.status)}>
                          {item.status ? text.disable : text.enable}
                        </Button>
                        <Button type="button" className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" onClick={() => removeRule(item.id, item.word)}>
                          {text.delete}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter>
          <AdminPaginationBar
            pagination={data.pagination}
            buildPageHref={buildPageHref}
            itemLabel={text.totalSuffix}
            className="w-full"
            align="center"
            previousLabel={text.previousPage}
            nextLabel={text.nextPage}
          />
        </CardFooter>
      </Card>
    </div>
  )
}

function getMatchTypeLabel(value: string) {
  return matchTypeOptions.find((item) => item.value === value)?.label ?? value
}

function getActionTypeLabel(value: string) {
  return actionTypeOptions.find((item) => item.value === value)?.label ?? text.reject
}
