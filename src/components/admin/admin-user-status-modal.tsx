"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { buildUserStatusExpirationDraft, USER_STATUS_EXPIRATION_PRESETS } from "@/lib/user-status-expiration-presets"

interface AdminUserStatusModalProps {
  userId: number
  username: string
  action: "mute" | "ban"
  triggerClassName?: string
  postId?: string
  commentId?: string
}

interface AdminUserStatusDialogProps extends Omit<AdminUserStatusModalProps, "triggerClassName"> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface BanCleanupOptions {
  offlineAllPosts: boolean
  offlineAllComments: boolean
  clearProfile: boolean
  clearSiteChatMessages: boolean
}

const defaultBanCleanupOptions: BanCleanupOptions = {
  offlineAllPosts: false,
  offlineAllComments: false,
  clearProfile: false,
  clearSiteChatMessages: false,
}

const banCleanupOptionItems: Array<{
  key: keyof BanCleanupOptions
  label: string
  description: string
}> = [
  {
    key: "offlineAllPosts",
    label: "下线该用户所有帖子",
    description: "把该用户仍在线或待审核的帖子统一标记为已下线。",
  },
  {
    key: "offlineAllComments",
    label: "下线该用户所有评论",
    description: "把该用户仍可见或待审核的评论统一隐藏。",
  },
  {
    key: "clearProfile",
    label: "清空个人签名和个人介绍",
    description: "清空个人简介；个人介绍功能开启时同步清空主页介绍。",
  },
  {
    key: "clearSiteChatMessages",
    label: "清空全站聊天室发言",
    description: "全站聊天室开启时删除该用户在聊天室里的所有发言。",
  },
]

export function AdminUserStatusDialog({ userId, username, action, postId, commentId, open, onOpenChange }: AdminUserStatusDialogProps) {
  const [message, setMessage] = useState("")
  const [feedback, setFeedback] = useState("")
  const [statusExpiresAt, setStatusExpiresAt] = useState("")
  const [banCleanupOptions, setBanCleanupOptions] = useState<BanCleanupOptions>(defaultBanCleanupOptions)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const actionText = action === "ban" ? "封禁" : "禁言"
  function setBanCleanupOption(key: keyof BanCleanupOptions, checked: boolean) {
    setBanCleanupOptions((current) => ({
      ...current,
      [key]: checked,
    }))
  }

  function setPresetExpiration(days: number | null) {
    if (!days) {
      setStatusExpiresAt("")
      return
    }

    setStatusExpiresAt(buildUserStatusExpirationDraft(days))
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={`确认${actionText}用户`}
      description={`当前操作用户：@${username}`}
      footer={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={action === "ban" ? "destructive" : "default"}
            disabled={isPending}
            className="h-9 rounded-full px-4 text-xs"
            onClick={() => {
              setFeedback("")
              startTransition(async () => {
                const response = await fetch("/api/admin/actions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: action === "ban" ? "user.ban" : "user.mute",
                    targetId: String(userId),
                    message,
                    statusExpiresAt: statusExpiresAt || null,
                    statusExpiresAtTimezoneOffsetMinutes: statusExpiresAt ? new Date().getTimezoneOffset() : null,
                    ...(action === "ban" ? banCleanupOptions : {}),
                    ...(postId ? { postId } : {}),
                    ...(commentId ? { commentId } : {}),
                  }),
                })
                const result = await response.json().catch(() => null) as { message?: string } | null
                if (response.ok) {
                  onOpenChange(false)
                  setMessage("")
                  setStatusExpiresAt("")
                  setBanCleanupOptions(defaultBanCleanupOptions)
                  router.refresh()
                  return
                }

                setFeedback(result?.message ?? "操作失败")
              })
            }}
          >
            {isPending ? "处理中..." : `确认${actionText}`}
          </Button>
          <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">自动解除时间</span>
          <Input
            type="datetime-local"
            value={statusExpiresAt}
            onChange={(event) => setStatusExpiresAt(event.target.value)}
            className="h-10 rounded-full bg-background"
          />
          <span className="text-xs text-muted-foreground">不填写则永久{actionText}。</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {USER_STATUS_EXPIRATION_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              className="h-7 rounded-full px-2.5 text-xs"
              onClick={() => setPresetExpiration(preset.days)}
              disabled={isPending}
            >
              {preset.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="h-7 rounded-full px-2.5 text-xs"
            onClick={() => setPresetExpiration(null)}
            disabled={isPending}
          >
            永久
          </Button>
        </div>
        {action === "ban" ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-foreground">封禁附加处理</p>
              <p className="text-xs leading-5 text-muted-foreground">按需勾选会立即批量处理该用户的历史内容。</p>
            </div>
            <div className="flex flex-col gap-2">
              {banCleanupOptionItems.map((item) => (
                <label key={item.key} className="flex items-start gap-2 rounded-lg px-1 py-1">
                  <Checkbox
                    checked={banCleanupOptions[item.key]}
                    onCheckedChange={(checked) => setBanCleanupOption(item.key, checked === true)}
                    disabled={isPending}
                    aria-label={item.label}
                    className="mt-0.5"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                    <span className="text-xs leading-5 text-muted-foreground">{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`填写${actionText}原因，不填写会使用默认公开原因`} className="min-h-[120px] rounded-xl bg-background px-4 py-3" />
        {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
      </div>
    </Modal>
  )
}

export function AdminUserStatusModal({ userId, username, action, triggerClassName, postId, commentId }: AdminUserStatusModalProps) {
  const [open, setOpen] = useState(false)
  const actionText = action === "ban" ? "封禁" : "禁言"

  return (
    <>
      <Button type="button" variant={action === "ban" ? "destructive" : "outline"} className={triggerClassName ?? "h-7 rounded-full px-2.5 text-xs"} onClick={() => setOpen(true)}>
        {actionText}
      </Button>
      <AdminUserStatusDialog
        userId={userId}
        username={username}
        action={action}
        postId={postId}
        commentId={commentId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

