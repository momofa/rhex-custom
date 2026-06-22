"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"

import { useInboxRealtime } from "@/components/inbox-realtime-provider"
import { Button } from "@/components/ui/rbutton"

export function NotificationsToolbar() {
  const router = useRouter()
  const { unreadNotificationCount: unreadCount } = useInboxRealtime()
  const [isPending, setIsPending] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleReadAll() {
    if (isPending || unreadCount === 0) {
      return
    }

    setIsPending(true)

    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      })

      if (!response.ok) {
        return
      }

      router.refresh()
    } finally {
      setIsPending(false)
    }
  }

  async function handleDeleteAll() {
    if (isDeleting) {
      return
    }

    const confirmed = window.confirm("确定删除所有消息通知吗？此操作不可恢复。")
    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch("/api/notifications/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deleteAll: true }),
      })

      if (!response.ok) {
        return
      }

      router.refresh()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">未读消息 {unreadCount} 条</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={isPending || unreadCount === 0} onClick={handleReadAll}>
          {isPending ? "处理中..." : "全部已读"}
        </Button>
        <Button type="button" variant="destructive" disabled={isDeleting} onClick={handleDeleteAll}>
          <Trash2 data-icon="inline-start" />
          {isDeleting ? "删除中..." : "一键删除"}
        </Button>
      </div>
    </div>
  )
}
