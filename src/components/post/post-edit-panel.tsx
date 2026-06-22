"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"


import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Textarea } from "@/components/ui/textarea"
import { formatCompactPointValue } from "@/lib/formatters"
import { formatPostEditWindowLabel, isPermanentPostEditWindow, isPostStillEditable } from "@/lib/post-edit-window"

interface PostEditPanelProps {
  postId: string
  postSlug: string
  createdAt?: string | null
  editWindowMinutes?: number
  lastAppendedAt?: string | null
  appendixCount?: number
  offlinePrice?: number
  offlinePriceLabel?: string
  pointName?: string
  canOffline?: boolean
}

const APPEND_INTERVAL_MINUTES = 60
const EDIT_WINDOW_TICK_MS = 30 * 1000


export function PostEditPanel({
  postId,
  postSlug,
  createdAt,
  editWindowMinutes = 10,
  lastAppendedAt,
  appendixCount = 0,
  offlinePrice = 0,
  offlinePriceLabel = "普通用户",
  pointName = "积分",
  canOffline = true,
}: PostEditPanelProps) {
  const [appendText, setAppendText] = useState("")
  const [offlineReason, setOfflineReason] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [offlineLoading, setOfflineLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [offlineModalOpen, setOfflineModalOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, EDIT_WINDOW_TICK_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const canEditOriginal = useMemo(() => (
    createdAt ? isPostStillEditable(createdAt, editWindowMinutes, currentTime) : false
  ), [createdAt, currentTime, editWindowMinutes])
  const nextAppendAt = useMemo(() => {

    if (!lastAppendedAt) {
      return null
    }

    return new Date(new Date(lastAppendedAt).getTime() + APPEND_INTERVAL_MINUTES * 60 * 1000)
  }, [lastAppendedAt])
  const appendCooldownMinutes = useMemo(() => {
    if (!nextAppendAt) {
      return 0
    }

    return Math.max(0, Math.ceil((nextAppendAt.getTime() - currentTime) / (60 * 1000)))
  }, [currentTime, nextAppendAt])

  const canAppendNow = appendCooldownMinutes === 0

  async function handleAppend() {
    if (!appendText.trim()) {
      setMessage("正文不能为空")
      return
    }

    setLoading(true)
    setMessage("")

    const response = await fetch("/api/posts/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        postId,
        appendedContent: appendText,
      }),
    })

    const result = await response.json()
    setLoading(false)
    setMessage(result.message ?? (response.ok ? "追加成功" : "追加失败"))

    if (response.ok) {
      setAppendText("")
      setModalOpen(false)
      window.location.reload()
    }
  }

  async function handleOffline() {
    setOfflineLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/posts/offline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId,
          reason: offlineReason,
        }),
      })

      const result = await response.json()
      setMessage(result.message ?? (response.ok ? "帖子已下线" : "帖子下线失败"))

      if (response.ok) {
        setOfflineModalOpen(false)
        window.location.reload()
      }
    } finally {
      setOfflineLoading(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">作者操作</h3>
            <p className="text-sm text-muted-foreground">
              {canEditOriginal
                ? `${isPermanentPostEditWindow(editWindowMinutes) ? "当前允许随时" : `发帖后 ${formatPostEditWindowLabel(editWindowMinutes)}内可`}跳转到编辑页修改标题和正文。`
                : `原帖正文已锁定，可通过弹窗追加附言。`}
            </p>
            <p className="text-xs text-muted-foreground">
              已追加 {appendixCount} 条附言{!canEditOriginal ? `，每次追加需间隔 ${APPEND_INTERVAL_MINUTES} 分钟` : ""}。
            </p>
            <p className="text-xs text-muted-foreground">
              下线帖子费用：{offlinePrice === 0 ? "免费" : `${formatCompactPointValue(offlinePrice)} ${pointName}`}（当前身份：{offlinePriceLabel}）。
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canOffline ? (
              <Button type="button" variant="outline" onClick={() => setOfflineModalOpen(true)}>
                下线帖子
              </Button>
            ) : null}
            {canEditOriginal ? (
              <Link href={`/write?mode=edit&post=${postSlug}`}>
                <Button type="button" variant="outline">编辑帖子</Button>
              </Link>
            ) : null}
            {!canEditOriginal ? (
              <Button type="button" variant="outline" onClick={() => setModalOpen(true)}>
                追加附言
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title="追加附言"
        description="只需填写正文内容，发布后会显示为新的附言。"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={loading}>取消</Button>
            <Button type="button" onClick={handleAppend} disabled={loading || !canAppendNow}>
              {loading ? "提交中..." : `发布第 ${appendixCount + 1} 条附言`}
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          {!canAppendNow ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              距离下一次追加还需等待 {appendCooldownMinutes} 分钟。
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-medium">正文</p>
            <Textarea
              value={appendText}
              onChange={(event) => setAppendText(event.target.value)}
              placeholder="写下新的进展、修正、结论或补充说明…"
              className="min-h-[220px] rounded-xl bg-card px-4 py-3 text-sm"
              disabled={!canAppendNow || loading}
            />
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </Modal>

      <Modal
        open={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
        size="md"
        title="下线帖子"
        description={`帖子下线后将不再对普通用户展示，当前身份费用为 ${offlinePrice === 0 ? "免费" : `${formatCompactPointValue(offlinePrice)} ${pointName}`}。`}
        footer={(
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOfflineModalOpen(false)} disabled={offlineLoading}>取消</Button>
            <Button type="button" onClick={handleOffline} disabled={offlineLoading}>
              {offlineLoading ? "处理中..." : "确认下线"}
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-[18px] border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            结算身份：{offlinePriceLabel}。{offlinePrice > 0 ? `提交后将扣除 ${formatCompactPointValue(offlinePrice)} ${pointName}。` : "当前配置为免费下线。"}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">下线说明（可选）</p>
            <Textarea
              value={offlineReason}
              onChange={(event) => setOfflineReason(event.target.value)}
              placeholder="例如：内容已过期，暂时下线整理。"
              className="min-h-[140px] rounded-xl bg-card px-4 py-3 text-sm"
              disabled={offlineLoading}
            />
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </Modal>
    </>
  )
}

