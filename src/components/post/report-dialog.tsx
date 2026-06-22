"use client"

import { type ReactNode, useCallback, useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Modal } from "@/components/ui/modal"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { REPORT_REASON_OPTIONS } from "@/lib/report-reasons"


interface ReportDialogProps {
  targetType: "POST" | "COMMENT" | "USER"
  targetId: string
  targetLabel: string
  buttonText?: string
  buttonClassName?: string
  buttonSize?: React.ComponentProps<typeof Button>["size"]
  icon?: ReactNode
  showLabelWithIcon?: boolean
}

export function ReportDialog({ targetType, targetId, targetLabel, buttonText = "举报", buttonClassName, buttonSize = "default", icon, showLabelWithIcon = false }: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reasonType, setReasonType] = useState<string>(REPORT_REASON_OPTIONS[0])
  const [reasonDetail, setReasonDetail] = useState("")
  const [isPending, startTransition] = useTransition()


  const title = useMemo(() => (targetType === "POST" ? "举报帖子" : targetType === "COMMENT" ? "举报回复" : "举报用户"), [targetType])

  const reset = useCallback(() => {
    setReasonType(REPORT_REASON_OPTIONS[0])
    setReasonDetail("")
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    reset()
  }, [reset])

  function submit() {
    startTransition(async () => {
      const response = await fetch("/api/reports/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reasonType,
          reasonDetail,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "举报失败", "举报失败")
        return
      }

      toast.success(result.message ?? "举报已提交", "举报成功")
      setTimeout(() => {
        handleClose()
      }, 600)
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size={buttonSize} title={buttonText} aria-label={buttonText} className={buttonClassName ?? "h-8 px-2 text-xs text-muted-foreground hover:text-foreground"} onClick={() => setOpen(true)}>
        {icon ? (
          <>
            {icon}
            {showLabelWithIcon ? <span>{buttonText}</span> : <span className="sr-only">{buttonText}</span>}
          </>
        ) : buttonText}
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        closeDisabled={isPending}
        closeOnEscape={!isPending}
        size="md"
        title={title}
        description={`举报对象：${targetLabel}`}
        hideHeaderCloseButtonOnMobile
        footer={(
          <div className="flex items-center gap-3">
            <Button type="button" disabled={isPending} onClick={submit}>
              {isPending ? "提交中..." : "提交举报"}
            </Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={handleClose}>
              取消
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <label className="block space-y-2 text-sm">
            <span className="font-medium text-foreground">举报原因</span>
            <Combobox
              items={REPORT_REASON_OPTIONS}
              value={reasonType}
              onValueChange={(value) => setReasonType(value ?? REPORT_REASON_OPTIONS[0])}
              disabled={isPending}
              autoHighlight
            >
              <ComboboxInput
                disabled={isPending}
                placeholder="请选择举报原因"
                className="h-11 rounded-[18px] bg-background text-sm"
              />
              <ComboboxContent className="rounded-[18px]">
                <ComboboxEmpty>没有匹配的举报原因</ComboboxEmpty>
                <ComboboxList>
                  {(reason: string) => (
                    <ComboboxItem key={reason} value={reason}>
                      {reason}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-foreground">补充说明</span>
            <Textarea
              value={reasonDetail}
              onChange={(event) => setReasonDetail(event.target.value)}
              placeholder="可补充时间、上下文或其它判断依据，帮助管理员更快处理。"
              className="min-h-[140px] rounded-xl bg-background px-4 py-3 text-sm"
            />
          </label>
        </div>
      </Modal>
    </>
  )
}

