"use client"

import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { SettingsSection } from "@/components/admin/admin-settings-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import {
  DEFAULT_EDITOR_TOOLBAR_ORDER,
  EDITOR_TOOLBAR_ITEM_DEFINITIONS,
  normalizeEditorToolbarSettings,
  type EditorToolbarItemKey,
  type EditorToolbarSettings,
} from "@/lib/editor-toolbar-settings"
import { cn } from "@/lib/utils"

interface AdminEditorToolbarSettingsFormProps {
  initialSettings: EditorToolbarSettings
}

function moveItem(
  order: EditorToolbarItemKey[],
  fromIndex: number,
  toIndex: number,
) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length
  ) {
    return order
  }

  const next = [...order]
  const [item] = next.splice(fromIndex, 1)
  if (!item) {
    return order
  }

  next.splice(toIndex, 0, item)
  return next
}

function normalizeForSubmit(settings: EditorToolbarSettings) {
  return normalizeEditorToolbarSettings({
    order: settings.order,
    hidden: settings.hidden,
  })
}

export function AdminEditorToolbarSettingsForm({
  initialSettings,
}: AdminEditorToolbarSettingsFormProps) {
  const router = useRouter()
  const [settings, setSettings] = useState(() => normalizeEditorToolbarSettings(initialSettings))
  const [draggingKey, setDraggingKey] = useState<EditorToolbarItemKey | null>(null)
  const [dragOverKey, setDragOverKey] = useState<EditorToolbarItemKey | null>(null)
  const [isPending, startTransition] = useTransition()
  const hiddenSet = useMemo(() => new Set(settings.hidden), [settings.hidden])
  const visibleCount = settings.order.length - hiddenSet.size

  function setOrder(order: EditorToolbarItemKey[]) {
    setSettings((current) => normalizeEditorToolbarSettings({
      ...current,
      order,
    }))
  }

  function setHidden(hidden: EditorToolbarItemKey[]) {
    setSettings((current) => normalizeEditorToolbarSettings({
      ...current,
      hidden,
    }))
  }

  function toggleVisible(key: EditorToolbarItemKey, visible: boolean) {
    setHidden(
      visible
        ? settings.hidden.filter((item) => item !== key)
        : Array.from(new Set([...settings.hidden, key])),
    )
  }

  function moveKey(key: EditorToolbarItemKey, direction: -1 | 1) {
    const fromIndex = settings.order.indexOf(key)
    const toIndex = fromIndex + direction
    setOrder(moveItem(settings.order, fromIndex, toIndex))
  }

  function handleDrop(targetKey: EditorToolbarItemKey) {
    if (!draggingKey || draggingKey === targetKey) {
      setDraggingKey(null)
      setDragOverKey(null)
      return
    }

    setOrder(moveItem(
      settings.order,
      settings.order.indexOf(draggingKey),
      settings.order.indexOf(targetKey),
    ))
    setDraggingKey(null)
    setDragOverKey(null)
  }

  function handleRestoreDefaults() {
    if (!window.confirm("确认恢复默认编辑器工具栏排序和显示状态吗？")) {
      return
    }

    setSettings(normalizeEditorToolbarSettings({
      order: DEFAULT_EDITOR_TOOLBAR_ORDER,
      hidden: [],
    }))
  }

  function handleSubmit() {
    const normalized = normalizeForSubmit(settings)

    startTransition(async () => {
      const result = await saveAdminSiteSettings({
        section: "site-editor-toolbar",
        editorToolbar: normalized,
      })

      if (!result.ok) {
        toast.error(result.message, "保存失败")
        return
      }

      setSettings(normalized)
      toast.success(result.message, "保存成功")
      router.refresh()
    })
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <SettingsSection
        title="编辑器工具栏"
        description="配置发帖、评论等 Markdown 编辑器的内置工具按钮排序和显示状态。插件注册的额外工具会继续显示在内置工具之后。"
        action={<Badge variant="outline">{visibleCount}/{settings.order.length} 显示</Badge>}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setHidden([])}>
              <Eye data-icon="inline-start" />
              全部显示
            </Button>
            <Button type="button" variant="outline" onClick={() => setHidden(settings.order)}>
              <EyeOff data-icon="inline-start" />
              全部隐藏
            </Button>
            <Button type="button" variant="ghost" onClick={handleRestoreDefaults}>
              <RotateCcw data-icon="inline-start" />
              恢复默认
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {settings.order.map((key, index) => {
              const item = EDITOR_TOOLBAR_ITEM_DEFINITIONS[key]
              const visible = !hiddenSet.has(key)
              const isDragging = draggingKey === key
              const isDragOver = dragOverKey === key && draggingKey !== key

              return (
                <div
                  key={key}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", key)
                    setDraggingKey(key)
                  }}
                  onDragEnd={() => {
                    setDraggingKey(null)
                    setDragOverKey(null)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                    setDragOverKey(key)
                  }}
                  onDragLeave={() => {
                    setDragOverKey((current) => current === key ? null : current)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    handleDrop(key)
                  }}
                  className={cn(
                    "grid gap-3 rounded-xl border border-border bg-background p-3 transition-colors md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center",
                    !visible && "bg-muted/35 opacity-75",
                    isDragging && "border-primary bg-primary/5 opacity-60",
                    isDragOver && "border-primary bg-primary/10",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="text-muted-foreground" aria-hidden="true" />
                    <Badge variant="outline">{index + 1}</Badge>
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-medium">{item.label}</span>
                      <Badge variant={visible ? "secondary" : "outline"}>
                        {visible ? "显示" : "隐藏"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={visible} onCheckedChange={(checked) => toggleVisible(key, Boolean(checked))} />
                    <span>{visible ? "显示" : "隐藏"}</span>
                  </label>

                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={index === 0}
                      aria-label={`上移 ${item.label}`}
                      title={`上移 ${item.label}`}
                      onClick={() => moveKey(key, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={index === settings.order.length - 1}
                      aria-label={`下移 ${item.label}`}
                      title={`下移 ${item.label}`}
                      onClick={() => moveKey(key, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-dashed border-border bg-card/40 p-4">
            <div className="flex flex-wrap gap-2">
              {settings.order.map((key) => {
                const item = EDITOR_TOOLBAR_ITEM_DEFINITIONS[key]
                const visible = !hiddenSet.has(key)

                return (
                  <Badge key={`preview-${key}`} variant={visible ? "secondary" : "outline"}>
                    {item.label}
                  </Badge>
                )
              })}
            </div>
          </div>
        </div>
      </SettingsSection>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : "保存编辑器工具栏"}
        </Button>
      </div>
    </form>
  )
}
