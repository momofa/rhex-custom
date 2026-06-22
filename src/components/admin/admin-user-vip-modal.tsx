"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CONFIGURABLE_VIP_LEVELS, isVipActive } from "@/lib/vip-status"

interface AdminUserVipModalProps {
  userId: number
  username: string
  vipLevel?: number
  vipExpiresAt?: string | null
}

export function AdminUserVipModal({ userId, username, vipLevel = 1, vipExpiresAt }: AdminUserVipModalProps) {
  const vipActive = isVipActive({ vipLevel, vipExpiresAt })
  const [open, setOpen] = useState(false)
  const [nextLevel, setNextLevel] = useState(String(vipLevel || 1))
  const [expiresAt, setExpiresAt] = useState(vipExpiresAt ? vipExpiresAt.slice(0, 16) : "")
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <>
      <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setOpen(true)}>
        VIP
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="配置 VIP 身份"
        description={`用户 @${username} 当前状态：${vipActive ? `VIP${vipLevel}` : "非 VIP"}`}
        footer={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={isPending}
              className="h-9 rounded-full px-4 text-xs"
              onClick={() => {
                startTransition(async () => {
                  const response = await fetch("/api/admin/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "user.vip.configure",
                      targetId: String(userId),
                      vipLevel: Number(nextLevel) || 1,
                      vipExpiresAt: expiresAt || null,
                      message,
                    }),
                  })
                  if (response.ok) {
                    setOpen(false)
                    router.refresh()
                  }
                })
              }}
            >
              {isPending ? "保存中..." : "保存 VIP 设置"}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">VIP 等级</p>
            <Select value={nextLevel} onValueChange={setNextLevel}>
              <SelectTrigger className="h-11 rounded-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFIGURABLE_VIP_LEVELS.map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    VIP{level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">到期时间</p>
            <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="h-11 rounded-full bg-background px-4" />
            <p className="text-xs text-muted-foreground">留空表示长期有效。</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">操作备注</p>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-[88px] rounded-xl bg-background px-4 py-3" placeholder="记录发放原因、套餐来源或工单编号" />
          </div>
        </div>
      </Modal>
    </>
  )
}

