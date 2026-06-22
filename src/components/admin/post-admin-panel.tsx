"use client"

import { useMemo, useState, useTransition } from "react"

import { Modal } from "@/components/ui/modal"
import { AdminUserStatusModal } from "@/components/admin/admin-user-status-modal"
import { BoardSelectField, type BoardSelectGroup } from "@/components/board/board-select-field"
import { Button } from "@/components/ui/rbutton"
import { Textarea } from "@/components/ui/textarea"
import { getPostPath } from "@/lib/post-links"
import type { PostLinkDisplayMode } from "@/lib/site-settings"

interface PostAdminPanelProps {
  postId: string
  postSlug: string
  currentBoardSlug: string
  actorRole: "ADMIN" | "MODERATOR"
  allowedPinScopes: Array<"NONE" | "BOARD" | "ZONE" | "GLOBAL">
  postAuthorId: number
  postAuthorUsername: string
  postAuthorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  postStatus?: string
  isPinned: boolean
  pinScope?: string | null
  isFeatured: boolean
  boardOptions: BoardSelectGroup[]
  postLinkDisplayMode?: PostLinkDisplayMode
}

interface AdminQuickAction {
  action: string
  targetId: string
  label: string
  tone?: "danger"
  extra?: Record<string, unknown>
  modalTitle?: string
  modalDescription?: string
  placeholder?: string
  confirmText?: string
  messageRequired?: boolean
}

export function PostAdminPanel({
  postId,
  postSlug,
  currentBoardSlug,
  actorRole,
  allowedPinScopes,
  postAuthorId,
  postAuthorUsername,
  postAuthorStatus,
  postStatus,
  isPinned,
  isFeatured,
  boardOptions,
  postLinkDisplayMode = "SLUG",
}: PostAdminPanelProps) {
  const [feedback, setFeedback] = useState("")
  const [moveBoardSlug, setMoveBoardSlug] = useState(currentBoardSlug)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<AdminQuickAction | null>(null)
  const [confirmMessage, setConfirmMessage] = useState("")
  const [confirmError, setConfirmError] = useState("")
  const [pendingAction, startTransition] = useTransition()

  const currentBoardLabel = useMemo(() => {
    for (const group of boardOptions) {
      const board = group.items.find((item) => item.value === currentBoardSlug)
      if (board) {
        return `${group.zone} / ${board.label}`
      }
    }

    return currentBoardSlug
  }, [boardOptions, currentBoardSlug])

  const selectedMoveBoardLabel = useMemo(() => {
    for (const group of boardOptions) {
      const board = group.items.find((item) => item.value === moveBoardSlug)
      if (board) {
        return `${group.zone} / ${board.label}`
      }
    }

    return moveBoardSlug
  }, [boardOptions, moveBoardSlug])

  async function runAction(action: string, targetId: string, extra?: Record<string, unknown>) {
    setFeedback("")

    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetId, postId, ...extra }),
      })
      const result = await response.json() as {
        message?: string
        data?: {
          id?: string
          slug?: string
        }
      }
      setFeedback(result.message ?? (response.ok ? "操作成功" : "操作失败"))
      if (response.ok) {
        if (action === "post.moveBoard") {
          const nextPostId = typeof result.data?.id === "string" && result.data.id ? result.data.id : postId
          const nextPostSlug = typeof result.data?.slug === "string" && result.data.slug ? result.data.slug : postSlug
          window.location.href = getPostPath({ id: nextPostId, slug: nextPostSlug }, { mode: postLinkDisplayMode })
          return
        }
        window.location.reload()
      }
    })
  }

  function openEditPage() {
    window.location.href = `/write?mode=edit&post=${encodeURIComponent(postSlug)}`
  }

  function openMoveDialog() {
    setMoveBoardSlug(currentBoardSlug)
    setFeedback("")
    setMoveDialogOpen(true)
  }

  function confirmMoveBoard() {
    if (!moveBoardSlug) {
      setFeedback("请选择目标节点")
      return
    }

    if (moveBoardSlug === currentBoardSlug) {
      setFeedback("帖子已在当前节点，无需移动")
      setMoveDialogOpen(false)
      return
    }

    setMoveDialogOpen(false)
    void runAction("post.moveBoard", postId, { boardSlug: moveBoardSlug })
  }

  function openConfirmAction(item: AdminQuickAction) {
    setConfirmAction(item)
    setConfirmMessage("")
    setConfirmError("")
  }

  function runQuickAction(item: AdminQuickAction) {
    if (item.modalTitle || item.placeholder) {
      openConfirmAction(item)
      return
    }

    void runAction(item.action, item.targetId, item.extra)
  }

  function submitConfirmAction() {
    if (!confirmAction) {
      return
    }

    const message = confirmMessage.trim()
    if (confirmAction.messageRequired && !message) {
      setConfirmError("请填写原因")
      return
    }

    setConfirmAction(null)
    setConfirmMessage("")
    setConfirmError("")
    void runAction(confirmAction.action, confirmAction.targetId, {
      ...confirmAction.extra,
      ...(message ? { message } : {}),
    })
  }

  const canEditPostContent = actorRole === "ADMIN"
  const userActions: AdminQuickAction[] = postAuthorStatus === "BANNED"
    ? (actorRole === "ADMIN" ? [{ action: "user.activate", targetId: String(postAuthorId), label: "解除封禁" }] : [])
    : postAuthorStatus === "MUTED"
      ? [
          { action: "user.activate", targetId: String(postAuthorId), label: "解除禁言" },
        ]
      : [
        ]
  const showMuteAuthorAction = postAuthorStatus !== "MUTED" && postAuthorStatus !== "BANNED"
  const showBanAuthorAction = actorRole === "ADMIN" && postAuthorStatus !== "BANNED"

  const pinActions: AdminQuickAction[] = isPinned
    ? (allowedPinScopes.includes("NONE")
      ? [{ action: "post.pin", targetId: postId, label: "取消置顶", extra: { scope: "NONE" } }]
      : [])
    : allowedPinScopes
        .filter((scope) => scope !== "NONE")
        .map((scope) => ({
          action: "post.pin",
          targetId: postId,
          label: scope === "GLOBAL" ? "全局置顶" : scope === "ZONE" ? "分区置顶" : "节点置顶",
          extra: { scope },
        }))

  const reviewActions: AdminQuickAction[] = postStatus === "PENDING"
    ? [
        { action: "post.approve", targetId: postId, label: "审核通过" },
        {
          action: "post.reject",
          targetId: postId,
          label: "驳回帖子",
          tone: "danger",
          modalTitle: "驳回帖子审核",
          modalDescription: "帖子会转为已下线状态，仅作者和管理员可见。驳回原因会展示给作者。",
          placeholder: "填写驳回原因，例如：内容不符合当前节点规则。",
          confirmText: "确认驳回",
          messageRequired: true,
        },
      ]
    : []

  const postStatusActions: AdminQuickAction[] = postStatus === "OFFLINE"
    ? [{ action: "post.show", targetId: postId, label: "上线帖子" }]
    : postStatus === "PENDING"
      ? []
    : [
        postStatus === "LOCKED"
          ? { action: "post.unlock", targetId: postId, label: "开放回复" }
          : { action: "post.lock", targetId: postId, label: "关闭回复" },
        {
          action: "post.hide",
          targetId: postId,
          label: "下线帖子",
          tone: "danger" as const,
          modalTitle: "下线帖子",
          modalDescription: "帖子下线后仅作者和管理员可见。填写原因后会展示给作者。",
          placeholder: "填写下线原因，例如：内容过期、违规或需作者修改。",
          confirmText: "确认下线",
        },
      ]

  const actions: AdminQuickAction[] = [
    ...reviewActions,
    ...pinActions,
    { action: "post.feature", targetId: postId, label: isFeatured ? "取消精华" : "设为精华" },
    ...userActions,
    ...postStatusActions,
    {
      action: "post.delete",
      targetId: postId,
      label: "删除帖子",
      tone: "danger" as const,
      modalTitle: "确认删除帖子",
      modalDescription: "删除后帖子、回复和相关互动数据会被永久移除，无法恢复。",
      placeholder: "可选：填写删除原因，便于记录后台日志。",
      confirmText: "确认删除",
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">管理员快捷操作</h3>
          <p className="mt-1 text-xs text-muted-foreground">目标用户 @{postAuthorUsername}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canEditPostContent ? (
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={openEditPage} disabled={pendingAction}>
            编辑帖子
          </Button>
        ) : null}
        <Button variant="outline" className="h-8 px-3 text-xs" onClick={openMoveDialog} disabled={pendingAction}>
          移动节点
        </Button>
        {actions.map((item) => (
          <Button
            key={`${item.action}-${item.label}`}
            variant={item.tone === "danger" ? "destructive" : "outline"}
            className="h-8 px-3 text-xs"
            onClick={() => runQuickAction(item)}
            disabled={pendingAction}
          >
            {item.label}
          </Button>
        ))}
        {showMuteAuthorAction ? (
          <AdminUserStatusModal
            userId={postAuthorId}
            username={postAuthorUsername}
            action="mute"
            postId={postId}
            triggerClassName="h-8 rounded-lg px-3 text-xs"
          />
        ) : null}
        {showBanAuthorAction ? (
          <AdminUserStatusModal
            userId={postAuthorId}
            username={postAuthorUsername}
            action="ban"
            postId={postId}
            triggerClassName="h-8 rounded-lg px-3 text-xs"
          />
        ) : null}
      </div>
      {feedback ? <p className="mt-2 text-xs text-muted-foreground">{feedback}</p> : null}

      <Modal
        open={moveDialogOpen}
        title="移动帖子节点"
        description="选择目标节点后确认，帖子会整体迁移到新的节点。"
        onClose={() => setMoveDialogOpen(false)}
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" className="h-9 px-4 text-sm" onClick={() => setMoveDialogOpen(false)} disabled={pendingAction}>
              取消
            </Button>
            <Button type="button" className="h-9 px-4 text-sm" onClick={confirmMoveBoard} disabled={pendingAction || !moveBoardSlug}>
              确定移动
            </Button>
          </div>
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-[18px] border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            <p>当前节点：{currentBoardLabel || "未知节点"}</p>
            <p className="mt-1">目标节点：{selectedMoveBoardLabel || "请选择目标节点"}</p>
          </div>
          <BoardSelectField
            value={moveBoardSlug}
            onChange={setMoveBoardSlug}
            boardOptions={boardOptions}
            disabled={pendingAction}
            title="选择目标节点"
            description="支持按分区、节点名或 slug 搜索，确认后帖子将移动到所选节点。"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmAction)}
        title={confirmAction?.modalTitle ?? "确认操作"}
        description={confirmAction?.modalDescription}
        onClose={() => {
          if (!pendingAction) {
            setConfirmAction(null)
            setConfirmMessage("")
            setConfirmError("")
          }
        }}
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" className="h-9 px-4 text-sm" onClick={() => setConfirmAction(null)} disabled={pendingAction}>
              取消
            </Button>
            <Button
              type="button"
              variant={confirmAction?.tone === "danger" ? "destructive" : "default"}
              className="h-9 px-4 text-sm"
              onClick={submitConfirmAction}
              disabled={pendingAction}
            >
              {pendingAction ? "处理中..." : confirmAction?.confirmText ?? "确认"}
            </Button>
          </div>
        )}
      >
        <div className="flex flex-col gap-3">
          {confirmAction?.placeholder ? (
            <Textarea
              value={confirmMessage}
              onChange={(event) => {
                setConfirmMessage(event.target.value)
                setConfirmError("")
              }}
              placeholder={confirmAction.placeholder}
              className="min-h-[120px] rounded-xl bg-card px-4 py-3 text-sm"
              disabled={pendingAction}
            />
          ) : null}
          {confirmError ? <p className="text-sm text-destructive">{confirmError}</p> : null}
        </div>
      </Modal>
    </div>
  )
}
