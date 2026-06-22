"use client"

import { Archive, Copy, PauseCircle, PlayCircle, Plus, Save, ShieldCheck, TimerReset, Trash2 } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { showConfirm } from "@/components/ui/alert-dialog"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FormModal } from "@/components/ui/modal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PostType, TaskCategory, TaskCycleType, TaskDefinitionStatus } from "@/db/types"
import { useAdminMutation } from "@/hooks/use-admin-mutation"
import { adminGet, adminPost } from "@/lib/admin-client"
import { type AdminTaskItem } from "@/lib/admin-task-center"
import {
  getTaskCategoryLabel,
  getTaskCycleTypeLabel,
  TASK_CONDITION_TEMPLATES,
  TASK_POST_TYPE_OPTIONS,
} from "@/lib/task-condition-templates"
import { cn } from "@/lib/utils"

interface AdminTaskManagerProps {
  initialTasks: AdminTaskItem[]
  boardOptions: TaskBoardOption[]
}

interface TaskBoardOption {
  id: string
  name: string
  slug: string
}

interface TaskDraft {
  id?: string
  title: string
  description: string
  category: TaskCategory
  cycleType: TaskCycleType
  conditionType: AdminTaskItem["conditionType"]
  targetCount: string
  rewardNormal: string
  rewardVip1: string
  rewardVip2: string
  rewardVip3: string
  sortOrder: string
  status: TaskDefinitionStatus
  startsAt: string
  endsAt: string
  conditionConfig: AdminTaskItem["conditionConfig"]
}

function createEmptyTaskDraft(): TaskDraft {
  return {
    title: "",
    description: "",
    category: TaskCategory.DAILY,
    cycleType: TaskCycleType.DAILY,
    conditionType: TASK_CONDITION_TEMPLATES[0].type,
    targetCount: "1",
    rewardNormal: "5",
    rewardVip1: "8",
    rewardVip2: "10",
    rewardVip3: "12",
    sortOrder: "0",
    status: TaskDefinitionStatus.ACTIVE,
    startsAt: "",
    endsAt: "",
    conditionConfig: {
      boardIds: [],
      postTypes: [],
    },
  }
}

function padDateTimeUnit(unit: number) {
  return String(unit).padStart(2, "0")
}

function formatDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return ""
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return value
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return ""
  }

  return [
    parsedDate.getFullYear(),
    padDateTimeUnit(parsedDate.getMonth() + 1),
    padDateTimeUnit(parsedDate.getDate()),
  ].join("-") + `T${padDateTimeUnit(parsedDate.getHours())}:${padDateTimeUnit(parsedDate.getMinutes())}`
}

function toIsoDateTimeValue(value: string) {
  if (!value.trim()) {
    return ""
  }

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? value : parsedDate.toISOString()
}

function isTaskCategory(value: unknown): value is TaskCategory {
  return value === TaskCategory.NEWBIE || value === TaskCategory.DAILY || value === TaskCategory.CHALLENGE
}

function isTaskCycleType(value: unknown): value is TaskCycleType {
  return value === TaskCycleType.PERMANENT || value === TaskCycleType.DAILY || value === TaskCycleType.WEEKLY
}

function isTaskDefinitionStatus(value: unknown): value is TaskDefinitionStatus {
  return value === TaskDefinitionStatus.ACTIVE || value === TaskDefinitionStatus.PAUSED || value === TaskDefinitionStatus.ARCHIVED
}

function isAdminTaskItem(value: unknown): value is AdminTaskItem {
  if (!value || typeof value !== "object") {
    return false
  }

  const item = value as Partial<AdminTaskItem>
  return typeof item.id === "string"
    && typeof item.code === "string"
    && typeof item.title === "string"
    && typeof item.targetCount === "number"
    && typeof item.sortOrder === "number"
    && isTaskCategory(item.category)
    && isTaskCycleType(item.cycleType)
    && typeof item.conditionType === "string"
    && typeof item.conditionSummary === "string"
    && typeof item.categoryLabel === "string"
    && typeof item.cycleTypeLabel === "string"
    && isTaskDefinitionStatus(item.status)
    && typeof item.rewardSummary?.normal === "string"
    && typeof item.rewardSummary?.vip1 === "string"
    && typeof item.rewardSummary?.vip2 === "string"
    && typeof item.rewardSummary?.vip3 === "string"
    && Array.isArray(item.conditionConfig?.boardIds)
    && Array.isArray(item.conditionConfig?.postTypes)
}

function isAdminTaskList(value: unknown): value is AdminTaskItem[] {
  return Array.isArray(value) && value.every(isAdminTaskItem)
}

function toDraft(item: AdminTaskItem): TaskDraft {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    category: item.category,
    cycleType: item.cycleType,
    conditionType: item.conditionType,
    targetCount: String(item.targetCount),
    rewardNormal: item.rewardSummary.normal,
    rewardVip1: item.rewardSummary.vip1,
    rewardVip2: item.rewardSummary.vip2,
    rewardVip3: item.rewardSummary.vip3,
    sortOrder: String(item.sortOrder),
    status: item.status,
    startsAt: formatDateTimeLocalValue(item.startsAt),
    endsAt: formatDateTimeLocalValue(item.endsAt),
    conditionConfig: {
      boardIds: [...item.conditionConfig.boardIds],
      postTypes: [...item.conditionConfig.postTypes],
    },
  }
}

function buildStatusMeta(status: TaskDefinitionStatus) {
  switch (status) {
    case TaskDefinitionStatus.ACTIVE:
      return { label: "启用中", tone: "text-emerald-600 dark:text-emerald-300" }
    case TaskDefinitionStatus.PAUSED:
      return { label: "已暂停", tone: "text-amber-600 dark:text-amber-300" }
    case TaskDefinitionStatus.ARCHIVED:
      return { label: "已归档", tone: "text-muted-foreground" }
    default:
      return { label: "未知状态", tone: "text-muted-foreground" }
  }
}

function getNextStatusActions(status: TaskDefinitionStatus) {
  if (status === TaskDefinitionStatus.ACTIVE) {
    return [
      { status: TaskDefinitionStatus.PAUSED, label: "暂停", icon: PauseCircle },
      { status: TaskDefinitionStatus.ARCHIVED, label: "归档", icon: Archive },
    ] as const
  }

  if (status === TaskDefinitionStatus.PAUSED) {
    return [
      { status: TaskDefinitionStatus.ACTIVE, label: "启用", icon: PlayCircle },
      { status: TaskDefinitionStatus.ARCHIVED, label: "归档", icon: Archive },
    ] as const
  }

  return [
    { status: TaskDefinitionStatus.ACTIVE, label: "恢复启用", icon: PlayCircle },
  ] as const
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
      </div>
      {children}
    </div>
  )
}

function toggleStringItem<T extends string>(items: readonly T[], value: T, checked: boolean) {
  if (checked) {
    return items.includes(value) ? [...items] : [...items, value]
  }

  return items.filter((item) => item !== value)
}

function buildConditionConfigForTemplate(draft: TaskDraft) {
  const template = TASK_CONDITION_TEMPLATES.find((item) => item.type === draft.conditionType) ?? TASK_CONDITION_TEMPLATES[0]

  return {
    boardIds: template.supportsBoardFilter ? draft.conditionConfig.boardIds : [],
    postTypes: template.supportsPostTypeFilter ? draft.conditionConfig.postTypes : [],
  }
}

function createTaskRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function AdminTaskManager({ initialTasks, boardOptions }: AdminTaskManagerProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [draft, setDraft] = useState<TaskDraft>(createEmptyTaskDraft())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)
  const activeActionRef = useRef<string | null>(null)
  const { isPending, runMutation } = useAdminMutation()
  const isBusy = Boolean(activeActionKey) || isPending

  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter((item) => item.status === TaskDefinitionStatus.ACTIVE).length,
    paused: tasks.filter((item) => item.status === TaskDefinitionStatus.PAUSED).length,
    archived: tasks.filter((item) => item.status === TaskDefinitionStatus.ARCHIVED).length,
  }), [tasks])

  const conditionTemplate = TASK_CONDITION_TEMPLATES.find((item) => item.type === draft.conditionType) ?? TASK_CONDITION_TEMPLATES[0]

  function updateDraft<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateConditionType(value: AdminTaskItem["conditionType"]) {
    setDraft((current) => {
      const template = TASK_CONDITION_TEMPLATES.find((item) => item.type === value) ?? TASK_CONDITION_TEMPLATES[0]

      return {
        ...current,
        conditionType: value,
        conditionConfig: {
          boardIds: template.supportsBoardFilter ? current.conditionConfig.boardIds : [],
          postTypes: template.supportsPostTypeFilter ? current.conditionConfig.postTypes : [],
        },
      }
    })
  }

  function updateBoardFilter(boardId: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      conditionConfig: {
        ...current.conditionConfig,
        boardIds: toggleStringItem(current.conditionConfig.boardIds, boardId, checked),
      },
    }))
  }

  function updatePostTypeFilter(postType: PostType, checked: boolean) {
    setDraft((current) => ({
      ...current,
      conditionConfig: {
        ...current.conditionConfig,
        postTypes: toggleStringItem(current.conditionConfig.postTypes, postType, checked) as PostType[],
      },
    }))
  }

  function resetDraft(nextDraft?: TaskDraft) {
    setDraft(nextDraft ?? createEmptyTaskDraft())
    setEditingId(null)
  }

  async function refreshList() {
    const result = await adminGet<AdminTaskItem[]>("/api/admin/tasks", {
      cache: "no-store",
      validateData: isAdminTaskList,
      invalidDataMessage: "任务列表返回格式不正确",
      defaultErrorMessage: "刷新任务列表失败",
    })

    setTasks(result.data)
  }

  function runTaskMutation(
    body: Record<string, unknown>,
    options: {
      actionKey: string
      successTitle: string
      errorTitle: string
      successMessage: string
      errorMessage: string
      onSuccess?: () => void | Promise<void>
    },
  ) {
    if (activeActionRef.current) {
      return
    }

    activeActionRef.current = options.actionKey
    setActiveActionKey(options.actionKey)
    runMutation({
      mutation: async () => {
        const result = await adminPost("/api/admin/tasks", body, {
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
      onSettled: () => {
        activeActionRef.current = null
        setActiveActionKey(null)
      },
    })
  }

  function openCreate() {
    const baseDraft = createEmptyTaskDraft()
    resetDraft({
      ...baseDraft,
      conditionType: TASK_CONDITION_TEMPLATES[0].type,
      targetCount: String(TASK_CONDITION_TEMPLATES[0].defaultTargetCount),
    })
    setModalOpen(true)
  }

  function openEdit(item: AdminTaskItem) {
    setDraft(toDraft(item))
    setEditingId(item.id)
    setModalOpen(true)
  }

  function submitDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activeActionRef.current) {
      return
    }

    runTaskMutation({
      action: "save",
      id: editingId ?? undefined,
      requestId: editingId ? undefined : createTaskRequestId(),
      title: draft.title,
      description: draft.description,
      category: draft.category,
      cycleType: draft.cycleType,
      conditionType: draft.conditionType,
      targetCount: draft.targetCount,
      rewardNormal: draft.rewardNormal,
      rewardVip1: draft.rewardVip1,
      rewardVip2: draft.rewardVip2,
      rewardVip3: draft.rewardVip3,
      sortOrder: draft.sortOrder,
      status: draft.status,
      startsAt: toIsoDateTimeValue(draft.startsAt),
      endsAt: toIsoDateTimeValue(draft.endsAt),
      conditionConfig: buildConditionConfigForTemplate(draft),
    }, {
      actionKey: editingId ? `save:${editingId}` : "create",
      successTitle: editingId ? "保存成功" : "创建成功",
      errorTitle: editingId ? "保存失败" : "创建失败",
      successMessage: editingId ? "任务已更新" : "任务已创建",
      errorMessage: editingId ? "任务保存失败" : "任务创建失败",
      onSuccess: () => {
        setModalOpen(false)
        resetDraft()
      },
    })
  }

  function submitDuplicate(id: string) {
    runTaskMutation({ action: "duplicate", id }, {
      actionKey: `duplicate:${id}`,
      successTitle: "复制成功",
      errorTitle: "复制失败",
      successMessage: "任务副本已创建",
      errorMessage: "任务复制失败",
    })
  }

  function submitStatus(id: string, status: TaskDefinitionStatus) {
    runTaskMutation({ action: "update-status", id, status }, {
      actionKey: `status:${id}:${status}`,
      successTitle: "状态已更新",
      errorTitle: "状态更新失败",
      successMessage: "任务状态已更新",
      errorMessage: "任务状态更新失败",
    })
  }

  async function submitDelete(item: AdminTaskItem) {
    if (activeActionRef.current) {
      return
    }

    const confirmed = await showConfirm({
      title: "删除任务",
      description: `确认彻底删除任务“${item.title}”吗？删除后该任务的用户进度和事件记录也会被移除，无法恢复。`,
      confirmText: "删除",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    runTaskMutation({ action: "delete", id: item.id }, {
      actionKey: `delete:${item.id}`,
      successTitle: "删除成功",
      errorTitle: "删除失败",
      successMessage: "任务已删除",
      errorMessage: "任务删除失败",
      onSuccess: () => {
        if (editingId === item.id) {
          setEditingId(null)
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>任务系统</CardTitle>
          <CardDescription>配置前台 /tasks 任务中心的成长任务。用户完成签到、发帖、回复、点赞、关注等行为后，系统按任务周期和 VIP 等级发放积分奖励。</CardDescription>
          <CardAction>
            <Button type="button" className="rounded-full" disabled={isBusy} onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建任务
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <AdminSummaryStrip
            items={[
              { label: "任务总数", value: stats.total, tone: "default" },
              { label: "启用中", value: stats.active, tone: "emerald", icon: <ShieldCheck className="h-4 w-4" /> },
              { label: "已暂停", value: stats.paused, tone: "amber", icon: <TimerReset className="h-4 w-4" /> },
              { label: "已归档", value: stats.archived, tone: "slate", icon: <Trash2 className="h-4 w-4" /> },
            ]}
          />

          <div className="grid gap-4">
            {tasks.map((item) => {
              const statusMeta = buildStatusMeta(item.status)
              const itemConditionTemplate = TASK_CONDITION_TEMPLATES.find((template) => template.type === item.conditionType) ?? TASK_CONDITION_TEMPLATES[0]

              return (
                <Card key={item.id}>
                  <CardHeader className="border-b">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <span className={`text-xs ${statusMeta.tone}`}>{statusMeta.label}</span>
                      </div>
                      <CardDescription>{item.description || item.conditionSummary}</CardDescription>
                    </div>
                    <CardAction className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => openEdit(item)}>编辑</Button>
                      <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => submitDuplicate(item.id)}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        复制
                      </Button>
                      {getNextStatusActions(item.status).map((action) => {
                        const Icon = action.icon
                        return (
                          <Button key={`${item.id}:${action.status}`} type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => submitStatus(item.id, action.status)}>
                            <Icon className="mr-1.5 h-3.5 w-3.5" />
                            {action.label}
                          </Button>
                        )
                      })}
                      <Button type="button" variant="destructive" size="sm" disabled={isBusy} onClick={() => void submitDelete(item)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        删除
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-secondary px-2.5 py-1">{item.categoryLabel}</span>
                      <span className="rounded-full bg-secondary px-2.5 py-1">{item.cycleTypeLabel}</span>
                      <span className="rounded-full bg-secondary px-2.5 py-1">{itemConditionTemplate.label}</span>
                    </div>
                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <div className="text-xs text-muted-foreground">完成条件</div>
                        <div className="mt-1">{item.conditionSummary}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">奖励配置</div>
                        <div className="mt-1">普通 {item.rewardSummary.normal} / VIP1 {item.rewardSummary.vip1} / VIP2 {item.rewardSummary.vip2} / VIP3 {item.rewardSummary.vip3}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">排序 / 生效</div>
                        <div className="mt-1">排序 {item.sortOrder} · {item.startsAt ? `开始 ${item.startsAt}` : "立即生效"} · {item.endsAt ? `结束 ${item.endsAt}` : "无截止"}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <FormModal
        open={modalOpen}
        onClose={() => {
          if (isBusy) {
            return
          }
          setModalOpen(false)
          resetDraft()
        }}
        closeDisabled={isBusy}
        closeOnEscape={!isBusy}
        title={editingId ? "编辑任务" : "新建任务"}
        description="奖励字段支持固定值 `5` 或随机区间 `5-10`。保存后，任务中心未完成任务会同步展示最新配置；已完成任务保留实际结算积分。"
        size="lg"
        onSubmit={submitDraft}
        footer={({ formId }) => (
          <>
            <Button type="button" variant="ghost" disabled={isBusy} onClick={() => {
              setModalOpen(false)
              resetDraft()
            }}>
              取消
            </Button>
            <Button type="submit" form={formId} disabled={isBusy}>
              <Save className="mr-2 h-4 w-4" />
              {isBusy ? "保存中..." : editingId ? "保存任务" : "创建任务"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="任务标题">
            <Input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="如 每日签到" />
          </Field>
          <Field label="目标次数">
            <Input value={draft.targetCount} onChange={(event) => updateDraft("targetCount", event.target.value)} placeholder={String(conditionTemplate.defaultTargetCount)} />
          </Field>
        </div>

        <Field label="任务描述">
          <Textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="可选，用于前台任务卡片说明。" rows={3} />
        </Field>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="任务分类">
            <Select value={draft.category} onValueChange={(value) => updateDraft("category", value as TaskCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TaskCategory.NEWBIE}>{getTaskCategoryLabel(TaskCategory.NEWBIE)}</SelectItem>
                <SelectItem value={TaskCategory.DAILY}>{getTaskCategoryLabel(TaskCategory.DAILY)}</SelectItem>
                <SelectItem value={TaskCategory.CHALLENGE}>{getTaskCategoryLabel(TaskCategory.CHALLENGE)}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="任务周期">
            <Select value={draft.cycleType} onValueChange={(value) => updateDraft("cycleType", value as TaskCycleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TaskCycleType.PERMANENT}>{getTaskCycleTypeLabel(TaskCycleType.PERMANENT)}</SelectItem>
                <SelectItem value={TaskCycleType.DAILY}>{getTaskCycleTypeLabel(TaskCycleType.DAILY)}</SelectItem>
                <SelectItem value={TaskCycleType.WEEKLY}>{getTaskCycleTypeLabel(TaskCycleType.WEEKLY)}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="条件模板">
            <Select value={draft.conditionType} onValueChange={(value) => updateConditionType(value as AdminTaskItem["conditionType"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_CONDITION_TEMPLATES.map((item) => (
                  <SelectItem key={item.type} value={item.type}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="状态">
            <Select value={draft.status} onValueChange={(value) => updateDraft("status", value as TaskDefinitionStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TaskDefinitionStatus.ACTIVE}>启用</SelectItem>
                <SelectItem value={TaskDefinitionStatus.PAUSED}>暂停</SelectItem>
                <SelectItem value={TaskDefinitionStatus.ARCHIVED}>归档</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="条件说明" helper={conditionTemplate.description}>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {conditionTemplate.supportsBoardFilter || conditionTemplate.supportsPostTypeFilter
              ? "下方筛选项留空时按全站统计；勾选后只会累计命中的内容或目标。"
              : "当前模板按全站统计，不需要额外筛选。"}
          </div>
        </Field>

        {conditionTemplate.supportsBoardFilter ? (
          <Field label="限定节点" helper="留空表示任意节点都可以累计；勾选后仅统计这些节点。">
            <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 md:grid-cols-2">
              {boardOptions.length > 0 ? boardOptions.map((board) => {
                const checked = draft.conditionConfig.boardIds.includes(board.id)
                return (
                  <label
                    key={board.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      checked ? "border-primary bg-primary/5" : "border-border bg-background",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => updateBoardFilter(board.id, Boolean(value))}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{board.name}</span>
                      <span className="block text-xs text-muted-foreground">/{board.slug}</span>
                    </span>
                  </label>
                )
              }) : (
                <div className="text-sm text-muted-foreground">当前还没有可选节点。</div>
              )}
            </div>
          </Field>
        ) : null}

        {conditionTemplate.supportsPostTypeFilter ? (
          <Field label="限定帖子类型" helper="留空表示所有帖子类型都可以累计；勾选后只统计这些类型。">
            <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {TASK_POST_TYPE_OPTIONS.map((option) => {
                const checked = draft.conditionConfig.postTypes.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      checked ? "border-primary bg-primary/5" : "border-border bg-background",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => updatePostTypeFilter(option.value, Boolean(value))}
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                  </label>
                )
              })}
            </div>
          </Field>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="开始时间" helper="可留空，按本地时区选择开始生效时间。">
            <Input type="datetime-local" value={draft.startsAt} onChange={(event) => updateDraft("startsAt", event.target.value)} />
          </Field>
          <Field label="结束时间" helper="可留空，表示没有到期时间。">
            <Input type="datetime-local" value={draft.endsAt} onChange={(event) => updateDraft("endsAt", event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="普通用户奖励">
            <Input value={draft.rewardNormal} onChange={(event) => updateDraft("rewardNormal", event.target.value)} placeholder="如 5 或 5-10" />
          </Field>
          <Field label="VIP1 奖励">
            <Input value={draft.rewardVip1} onChange={(event) => updateDraft("rewardVip1", event.target.value)} placeholder="如 8 或 8-12" />
          </Field>
          <Field label="VIP2 奖励">
            <Input value={draft.rewardVip2} onChange={(event) => updateDraft("rewardVip2", event.target.value)} placeholder="如 10 或 10-15" />
          </Field>
          <Field label="VIP3 奖励">
            <Input value={draft.rewardVip3} onChange={(event) => updateDraft("rewardVip3", event.target.value)} placeholder="如 12 或 12-18" />
          </Field>
        </div>

        <Field label="排序值" helper="数字越小越靠前。">
          <Input value={draft.sortOrder} onChange={(event) => updateDraft("sortOrder", event.target.value)} placeholder="默认 0" />
        </Field>
      </FormModal>
    </div>
  )
}
